from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from datetime import datetime
from geopy.distance import geodesic
import requests

from .models import CustomUser, RideRequest, CarpoolRide, RideMatch, UserPreferences, UserLocation
from .utils import send_notification

@shared_task
def check_license_expiry():
    """Checks all users' license expiry dates and notifies them if close to expiration."""
    NTSA_API_URL = "https://tims.ntsa.go.ke/api/check_license"
    API_KEY = settings.NTSA_API_KEY

    drivers = CustomUser.objects.exclude(driving_license_number=None)

    for driver in drivers:
        response = requests.post(
            NTSA_API_URL,
            json={"license_number": driver.driving_license_number},
            headers={"Authorization": f"Bearer {API_KEY}"}
        )

        if response.status_code == 200:
            data = response.json()
            expiry_date_str = data.get("expiry_date")  # e.g., "2025-12-31"
            try:
                expiry_date = datetime.strptime(expiry_date_str, "%Y-%m-%d").date()
                days_left = (expiry_date - timezone.now().date()).days

                if days_left <= 30:
                    send_mail(
                        "🚨 Driving License Expiry Warning",
                        f"Your driving license will expire in {days_left} days. Renew ASAP!",
                        "no-reply@yourapp.com",
                        [driver.email]
                    )
            except (ValueError, TypeError):
                print(f"Invalid expiry_date for driver {driver.id}: {expiry_date_str}")

    return "License expiry check completed."

@shared_task
def check_driver_proximity(ride_id):
    """Check if the driver is near the pickup location and notify the passenger."""
    try:
        ride = CarpoolRide.objects.get(id=ride_id)
        driver_location = UserLocation.objects.get(driver=ride.driver)
        ride_requests = RideRequest.objects.filter(ride=ride, status="accepted")

        for request in ride_requests:
            passenger = request.passenger
            # Assuming pickup_latitude and pickup_longitude are float fields
            passenger_coords = (request.pickup_latitude, request.pickup_longitude)
            driver_coords = (driver_location.latitude, driver_location.longitude)
            distance = geodesic(driver_coords, passenger_coords).meters

            if distance <= 500:  # Notify if within 500 meters
                send_notification(
                    user=passenger,
                    title="Your Ride is Almost Here!",
                    message=f"{ride.driver.full_name} is arriving soon at your pickup location."
                )

    except (CarpoolRide.DoesNotExist, UserLocation.DoesNotExist):
        pass  # Ride or location might not exist

@shared_task
def match_passengers_to_rides():
    """Match passengers to rides based on location, time, and preferences."""
    rides = CarpoolRide.objects.filter(
        status="pending",
        is_completed=False,
        is_cancelled=False,
        is_full=False,
        available_seats__gt=0
    )

    for ride in rides:
        ride_requests = RideRequest.objects.filter(status="pending").select_related("passenger")

        for ride_request in ride_requests:
            passenger = ride_request.passenger
            if RideMatch.objects.filter(passenger=passenger, ride=ride).exists():
                continue

            score = calculate_match_score(ride_request, ride)
            if score > 0.7:  # Threshold for a good match
                RideMatch.objects.create(
                    passenger=passenger,
                    ride=ride,
                    score=score
                )

def calculate_match_score(ride_request, ride):
    """Calculate a match score based on location, time, and preferences."""
    score = 0.0
    try:
        # Location proximity
        pickup_location = ride_request.pickup_location
        if pickup_location and "lat" in pickup_location and "lng" in pickup_location:
            passenger_coords = (pickup_location["lat"], pickup_location["lng"])
            ride_origin = (ride.origin["lat"], ride.origin["lng"])
            distance = geodesic(passenger_coords, ride_origin).km
            score += max(0, 1 - distance / 50) * 0.5  # 50km max range, 50% weight

        # Time compatibility
        time_diff = abs((ride.departure_time - ride_request.created_at).total_seconds() / 3600)
        score += max(0, 1 - time_diff / 2) * 0.3  # 2-hour window, 30% weight

        # Women-only preference
        passenger = ride_request.passenger
        preferences = getattr(passenger, "preferences", None)
        if ride.is_women_only and (passenger.gender == "female" or (preferences and preferences.prefers_women_only_rides)):
            score += 0.2  # 20% weight for preference match
        elif not ride.is_women_only and preferences and preferences.prefers_women_only_rides:
            score -= 0.2  # Penalize if passenger prefers women-only but ride isn't

        return min(max(score, 0), 1)  # Normalize between 0 and 1
    except Exception as e:
        print(f"Error calculating match score for {ride_request.passenger.fullname}: {e}")
        return 0.0
    
# # tasks.py
# from celery import shared_task
# from django.core.mail import EmailMultiAlternatives
# from django.template.loader import render_to_string

# @shared_task
# def send_email_async(subject, to_email, context):
#     text_content = render_to_string('emails/base_email.txt', context)
#     html_content = render_to_string('emails/base_email.html', context)
#     email = EmailMultiAlternatives(
#         subject=subject,
#         body=text_content,
#         from_email=settings.DEFAULT_FROM_EMAIL,
#         to=[to_email] if isinstance(to_email, str) else to_email,
#     )
#     email.attach_alternative(html_content, "text/html")
#     email.send()

# in the views
# send_email_async.delay(subject, user.email, context)
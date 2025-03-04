from django.core.mail import send_mail
from django.utils.timezone import now, timedelta
from Taxi.models import CustomUser
import requests
from django.conf import settings
from carpool.backend.celery import shared_task

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
            expiry_date = data.get("expiry_date")  # Assuming NTSA API provides this
            days_left = (expiry_date - now().date()).days

            if days_left <= 30:
                send_mail(
                    "🚨 Driving License Expiry Warning",
                    f"Your driving license will expire in {days_left} days. Renew ASAP!",
                    "no-reply@yourapp.com",
                    [driver.email]
                )

    return "License expiry check completed."

"""Celery task that runs periodically to check the driver's location and notify the passenger when the driver is nearby."""
# from carpool.backend.celery import shared_task
from Taxi.models import DriverLocation, RideRequest, CarpoolRide
from Taxi.utils import send_notification  # Assume we have a notification system

@shared_task
def check_driver_proximity(ride_id):
    """Check if the driver is near the pickup location and notify the passenger."""
    try:
        ride = CarpoolRide.objects.get(id=ride_id)
        driver_location = DriverLocation.objects.get(driver=ride.driver)
        ride_requests = RideRequest.objects.filter(ride=ride, status="accepted")

        for request in ride_requests:
            passenger = request.passenger
            distance = driver_location.distance_to(request.pickup_latitude, request.pickup_longitude)

            if distance <= 500:  # Notify if within 500 meters
                send_notification(
                    user=passenger,
                    title="Your Ride is Almost Here!",
                    message=f"{ride.driver.full_name} is arriving soon at your pickup location."
                )

    except (CarpoolRide.DoesNotExist, DriverLocation.DoesNotExist):
        pass  # Ride or location might not exist
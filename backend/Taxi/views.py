from django.shortcuts import render

# Create your views here.

#driver's view
from rest_framework.views import APIView
from rest_framework.generics import CreateAPIView, UpdateAPIView, ListAPIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import CustomUser

class DriverDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if not user.is_driver:
            return Response({"error": "Access denied. Not a driver."}, status=403)

        return Response({
            "full_name": f"{user.first_name} {user.last_name}",
            "phone_number": user.phone_number,
            "is_verified": user.is_verified,
            "wallet_balance": user.wallet_balance,
            "rating": user.rating,
            "id":user.id,
        })

        #to list ride requests for the driver
from Taxi.serializers import RideRequestSerializer, CarpoolRideSerializer
from Taxi.models import CarpoolRide
from rest_framework.viewsets import ModelViewSet
import logging

logger = logging.getLogger(__name__)
class DriverRideRequestsView(ListAPIView):
    serializer_class = RideRequestSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = RideRequest.objects.filter(
            ride__driver=self.request.user,
            ride__status__in=['pending', 'in_progress'],
            status__in=['pending', 'accepted']
        ).order_by('-created_at')
        logger.debug(f"Driver ride requests queryset: {queryset.count()} requests")
        return queryset
    
    # API Endpoint for Drivers to Post Rides:
from Taxi.serializers import CarpoolRideCreateSerializer
"""first drivers can create rides"""
from rest_framework.exceptions import ValidationError
class CreateCarpoolRideView(CreateAPIView):
    serializer_class = CarpoolRideCreateSerializer
    permission_classes = [IsAuthenticated]  # Only logged-in users can create rides

    def perform_create(self, serializer):
        user= self.request.user
         # Check if driver has a ride that is pending or in progress
        ongoing_ride = CarpoolRide.objects.filter(
            driver=user,
            status__in=['pending', 'in_progress']
        ).exists()

        if ongoing_ride:
            # raise ValidationError({
            #     "non_field_errors": ["You already have an active ride in progress or pending. Please complete it before creating a new one."]
            # })
            raise ValidationError("You already have an active ride in progress or pending. Please complete it before creating a new one.")
   
        try:
            serializer.save(driver=self.request.user)
        except ValidationError as e:
            logger.error(f"Serializer validation error: {e.detail}")  # Log validation errors
            raise
    
    #for the request user (driver who created specific ride to edit their ride)
from django.core.exceptions import PermissionDenied
from django.utils.dateparse import parse_datetime
class UpdateCarpoolRideView(UpdateAPIView):
    """official driver update ride"""
    serializer_class = CarpoolRideSerializer
    permission_classes = [IsAuthenticated]
    queryset = CarpoolRide.objects.all()
    def perform_update(self, serializer):
        if serializer.instance.driver != self.request.user:
            raise PermissionDenied("You can only update your own rides.")

        # Parse departure_time if needed
       
        logger.info(f"Validated data before save: {serializer.validated_data}")
        print(f"Validated data before save: {serializer.validated_data}")
        updated_ride = serializer.save()
        print(f"Updated ride departure time: {updated_ride.departure_time}")

        # Notify passengers
        accepted_requests = RideRequest.objects.filter(ride=updated_ride, status="accepted")
        for req in accepted_requests:
            message = f"The ride from {updated_ride.origin['label']} to {updated_ride.destination['label']} has been updated by the driver. New departure time: {updated_ride.departure_time}. Please review and cancel if it no longer suits you."
            notify_user(req.passenger, message, carpoolride_id=str(updated_ride.carpoolride_id))
            # notify_user(req.passenger, message)

        return updated_ride
    
        # driver rides viewset
class CarpoolRideViewSet(ModelViewSet):
    """official carpool ride view set"""
    queryset = CarpoolRide.objects.all()
    serializer_class = CarpoolRideSerializer
    
    def get_queryset(self):
        # print(f"this is the ridseviewset: {self.request.query_params}")
        queryset = super().get_queryset()
        driver = self.request.query_params.get("driver", None)
        if driver == "me":
            queryset = queryset.filter(driver=self.request.user)
        is_women_only = self.request.query_params.get("is_women_only", None)
        if is_women_only == "true":
            queryset = queryset.filter(is_women_only=True)
        return queryset
from Taxi.serializers import RideHistorySerializer
from rest_framework.pagination import PageNumberPagination
class CustomPagination(PageNumberPagination):
    page_size = 5  # Default number of items per page
    page_size_query_param = 'limit'  # Allow client to specify limit
    max_page_size = 10  # Maximum limit

class RideHistoryView(ListAPIView):
    serializer_class = RideHistorySerializer
    permission_classes = [IsAuthenticated]
    pagination_class = CustomPagination

    def get_queryset(self):
        user = self.request.user
        user_requests = RideRequest.objects.filter(passenger=user).values_list('ride_id', flat=True)
        return CarpoolRide.objects.filter(
            Q(driver=user) | Q(carpoolride_id__in=user_requests),
            status='completed'
        ).distinct().order_by('-last_updated')
       
    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)  # Use built-in paginated response
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'results': serializer.data,
            'total': queryset.count(),
            'total_pages': 1,
            'current_page': 1,
        })
        



class DriverCancelRideView(APIView):
    """official for driver to cancel ride"""
    permission_classes = [IsAuthenticated]

    def post(self, request, carpoolride_id):
        try:
            ride = CarpoolRide.objects.get(carpoolride_id=carpoolride_id)
        except CarpoolRide.DoesNotExist:
            return Response({"error": "Ride not found"}, status=status.HTTP_404_NOT_FOUND)

        # Ensure only the driver can cancel their ride
        if ride.driver != request.user:
            return Response({"error": "Unauthorized action"}, status=status.HTTP_403_FORBIDDEN)

        # Check if ride is already cancelled or completed
        if ride.is_cancelled:
            return Response({"error": "Ride is already cancelled"}, status=status.HTTP_400_BAD_REQUEST)
        if ride.is_completed:
            return Response({"error": "Ride is already completed"}, status=status.HTTP_400_BAD_REQUEST)

        # Refund all passengers with accepted requests
        accepted_requests = RideRequest.objects.filter(ride=ride, status="accepted")
        for req in accepted_requests:
            user_wallet, _ = UserWallet.objects.get_or_create(user=req.passenger)
            refund_amount = ride.fare  # Full refund for driver cancellation
            user_wallet.refund_escrow(refund_amount)

            # Record transaction
            reference = f"REF-{get_random_string(10)}"
            WalletTransaction.objects.create(
                user=req.passenger,
                amount=refund_amount,
                transaction_type="ride_refund",
                status="completed",
                reference=reference
            )

            # Notify passenger
            message = f"The ride from {ride.origin['label']} to {ride.destination['label']} on {ride.departure_time} has been cancelled by the driver. A full refund of {refund_amount} has been issued."
            notify_user(req.passenger, message)

        # Mark ride as cancelled
        ride.is_cancelled = True
        ride.save()

        return Response({
            "message": "Ride cancelled successfully. All passengers have been refunded and notified.",
        }, status=status.HTTP_200_OK)
        

# from rest_framework.parsers import MultiPartParser, FormParser
class UploadIDImageView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        id_front = request.FILES.get("id_front")
        id_back = request.FILES.get("id_back")

        if id_front:
            user.save_id_image(id_front, "front")
        if id_back:
            user.save_id_image(id_back, "back")

        return Response({"message": "ID images uploaded successfully"}, status=200)


class WalletBalanceView(APIView):
    """still used for driver wallet ballance"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if not user.is_driver:
            return Response({"error": "Access denied. Not a driver."}, status=403)

        return Response({"wallet_balance": user.wallet_balance})
    

    # Toggle online status
    """to be deleted    ........."""
class DriverAvailabilityView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if not user.is_driver:
            return Response({"error": "Access denied. Not a driver."}, status=403)

        user.is_available = not user.is_available  # Toggle availability
        user.save()
        return Response({"message": f"Driver is now {'online' if user.is_available else 'offline'}."})


import re
from Taxi.models import CarpoolRide, RideRequest, UserLocation, Vehicle
from urllib.parse import urlencode
import logging
logger = logging.getLogger(__name__)

class OptimizeRouteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        print(f"this is the request data in optimizeroutevieww:{request.data}")
        current_location = request.data.get('currentLocation')
        ride_id = request.data.get('ride_id')

        logger.info(f"Received optimize route data: {request.data}")
        logger.info(f"Current location: {current_location}")

        if not current_location or not ride_id:
            return Response(
                {'error': 'Current location and ride ID are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if "latitude" not in current_location or "longitude" not in current_location:
            logger.error("currentLocation must include latitude and longitude")
            return Response(
                {"error": "Invalid current location format (must include latitude, longitude)"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Validate ride and driver
            ride = CarpoolRide.objects.get(carpoolride_id=ride_id, driver=request.user)
            if ride.status != 'in_progress':
                return Response(
                    {'error': 'Ride must be in progress'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Get accepted ride requests
            accepted_requests = RideRequest.objects.filter(ride=ride, status='accepted')
            logger.info(f"Accepted requests: {list(accepted_requests.values('pickup_location'))}")

            # Validate coordinates
            lat_lng_pattern = re.compile(r'^-?\d+\.\d+,-?\d+\.\d+$')
            try:
                origin = f"{current_location['latitude']},{current_location['longitude']}"
                logger.info(f"Origin: {origin}")
            except (KeyError, TypeError):
                return Response(
                    {'error': 'Invalid current location format (must include latitude, longitude)'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if not lat_lng_pattern.match(origin):
                return Response(
                    {'error': 'Invalid current location coordinates'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            try:
                destination = f"{ride.destination['lat']},{ride.destination['lng']}"
                logger.info(f"Destination: {destination}")
            except (KeyError, TypeError):
                return Response(
                    {'error': 'Invalid destination format (must include lat, lng)'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if not lat_lng_pattern.match(destination):
                return Response(
                    {'error': 'Invalid destination coordinates'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Get passenger pickup locations
            waypoints = []
            for req in accepted_requests:
                pickup = req.pickup_location
                logger.info(f"Pickup location for request {req.ridrequest_id}: {pickup}")
                if not isinstance(pickup, dict):
                    return Response(
                        {'error': f"Invalid pickup location format for request {req.ridrequest_id} (must be a JSON object)"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                if not all(key in pickup for key in ['lat', 'lng']):
                    return Response(
                        {'error': f"Pickup location missing lat/lng for request {req.ridrequest_id}"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                waypoint = f"{pickup['lat']},{pickup['lng']}"
                if not lat_lng_pattern.match(waypoint):
                    return Response(
                        {'error': f"Invalid waypoint coordinates for request {req.ridrequest_id}"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                waypoints.append(waypoint)
            waypoints_str = '|'.join(waypoints) if waypoints else ''
            logger.info(f"Waypoints: {waypoints_str}")

            # Google Maps Directions API request
            url = 'https://maps.googleapis.com/maps/api/directions/json'
            params = {
                'origin': origin,
                'destination': destination,
                'waypoints': f"optimize:true|{waypoints_str}" if waypoints_str else '',
                'key': settings.GOOGLE_MAPS_API_KEY,
            }
            # Log the full API URL
            api_url = f"{url}?{urlencode(params)}"
            logger.debug(f"Directions API request URL: {api_url}")
            print(f"Directions API request params: {params}")

            response = requests.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            logger.info(f"Directions API response: {data}")

            if data.get('status') == 'NOT_FOUND':
                return Response(
                    {'error': 'No route found. Check origin, waypoints, or destination coordinates.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if data.get('status') != 'OK':
                return Response(
                    {'error': f"Directions API error: {data.get('status')} - {data.get('error_message', 'No details')}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Include passenger data
            passenger_data = [
                {
                    'user_id': req.passenger.id,
                    'pickup_lat': req.pickup_location['lat'],
                    'pickup_lng': req.pickup_location['lng'],
                    'label': req.pickup_location['label'],
                    'name': req.passenger.fullname,
                }
                for req in accepted_requests
            ]

            return Response({
                'status': data.get('status'),
                'optimized_order': data.get('routes', [{}])[0].get('waypoint_order', []),
                'route': data.get('routes', [{}])[0],
                'passengers': passenger_data,
                'ride_id': str(ride.carpoolride_id),
            })

        except CarpoolRide.DoesNotExist:
            return Response(
                {'error': 'Ride not found or not authorized'},
                status=status.HTTP_404_NOT_FOUND
            )
        except requests.RequestException as e:
            return Response(
                {'error': f'Failed to optimize route: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except KeyError as e:
            return Response(
                {'error': f'Missing required field: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Unexpected error in OptimizeRouteView: {str(e)}")
            return Response(
                {'error': f'Internal server error: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.contrib.auth import get_user_model
from Taxi.firebase import send_push_notification
from .models import Notification
from django.utils import timezone
from datetime import timedelta

User = get_user_model()

class SendNotificationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user_id = request.data.get("user_id")
        message = request.data.get("message")
        carpoolride_id = request.data.get("carpoolride_id")

        if not user_id or not message or not carpoolride_id:
            return Response({"error": "user_id, message, and carpoolride_id are required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        # Check for existing notifications within the last 5 minutes
        five_minutes_ago = timezone.now() - timedelta(minutes=5)
        existing_notification = Notification.objects.filter(
            user=user,
            carpoolride_id=carpoolride_id,
            created_at__gte=five_minutes_ago
        ).first()

        if existing_notification:
            if existing_notification.is_new:
                return Response({
                    "status": "Notification already sent and pending within 5 minutes",
                    "notification_id": existing_notification.notification_id,
                    "is_updated": False
                }, status=status.HTTP_200_OK)
            if not existing_notification.is_new:
                # Skip if dismissed, don't re-create or send
                return Response({
                    "status": "Notification already dismissed, not re-sending",
                    "notification_id": existing_notification.notification_id,
                    "is_updated": False
                }, status=status.HTTP_200_OK)
            # Update existing notification if dismissed (optional, remove if not needed)
            existing_notification.message = message
            existing_notification.is_new = True
            existing_notification.created_at = timezone.now()
            existing_notification.save()
            notification = existing_notification
            is_updated = True
        else:
            # Create new notification
            notification = Notification.objects.create(
                user=user,
                carpoolride_id=carpoolride_id,
                message=message,
                type="request",
                is_new=True
            )
            is_updated = False

        group_name = f"user_{user_id}"
        channel_layer = get_channel_layer()
        websocket_sent = False

        # Try WebSocket push
        try:
            async_to_sync(channel_layer.group_send)(
                group_name,
                {
                    "type": "send_notification",
                    "user_id": user_id,
                    "message": message,
                    "carpoolride_id": carpoolride_id,
                    "notification_id": str(notification.notification_id),
                }
            )
            websocket_sent = True
        except Exception as e:
            print(f"WebSocket send error for user {user_id}: {e}")

        # Fallback to Firebase
        try:
            fcm_token = getattr(user, "fcm_token", None)
            if fcm_token:
                send_push_notification(
                    token=fcm_token,
                    title="Ride Notification",
                    body=message
                )
        except Exception as e:
            print(f"Error sending Firebase notification: {e}")

        return Response({
            "status": "Notification sent via WebSocket" if websocket_sent else "Firebase fallback used",
            "notification_id": notification.notification_id,
            "is_updated": is_updated
        }, status=status.HTTP_200_OK)


            

from .serializers import RideRequestSerializer, CarpoolRideSerializer
from rest_framework.generics import UpdateAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import serializers
from .models import RideRequest, CarpoolRide
# from .serializers import RideRequestSerializer
from Taxi.utils import notify_user  # Import notification syste

"""this is themain one for drivers to allow passengers to join their carpool"""
from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import RideRequest, CarpoolRide
from .serializers import RideRequestSerializer

class AcceptRideRequestView(UpdateAPIView):
    """View to allow a driver to accept a ride request.
     --Ensures only the driver can accept requests.
     --Prevents overbooking (if available_seats is too low, it rejects the request).
     --Updates the ride request status to "accepted".
     --Reduces available_seats by the number of seats requested.
     """
    
    queryset = RideRequest.objects.all()
    serializer_class = RideRequestSerializer
    permission_classes = [IsAuthenticated]

    def update(self, request, *args, **kwargs):
        ride_request = self.get_object()

        if ride_request.ride.driver != request.user:
            return Response({"error": "Only the ride driver can accept requests."}, status=status.HTTP_403_FORBIDDEN)

        if ride_request.seats_requested > ride_request.ride.available_seats:
            return Response(
                {"error": f"Not enough available seats. Only {ride_request.ride.available_seats} left."},
                status=status.HTTP_400_BAD_REQUEST
            )

        passenger_wallet = UserWallet.objects.get(user=ride_request.passenger)
        driver = ride_request.ride.driver
        driver_wallet, _ = UserWallet.objects.get_or_create(user=driver)

        # Calculate total fare
        fare = ride_request.ride.contribution_per_seat * ride_request.seats_requested

        if passenger_wallet.balance < fare:
            return Response({"error": "Passenger has insufficient balance."},
                            status=status.HTTP_400_BAD_REQUEST)

        # Move funds to escrow
        if passenger_wallet.hold_in_escrow(fare):
            # Create transaction record
            WalletTransaction.objects.create(
                user=ride_request.passenger,
                recipient=driver,
                amount=fare,
                transaction_type="escrow_hold",
                status="completed",
                reference=f"RID-{get_random_string(8)}",
                sender_name=ride_request.passenger.fullname,
                sender_phone=ride_request.passenger.phone_number,
                recipient_name=driver.fullname,
                recipient_phone=driver.phone_number
                # ride=ride # link payment with ride
            )

            ride_request.status = "accepted"
            ride_request.payment_status = "paid"
            ride_request.save()

            ride_request.ride.available_seats -= ride_request.seats_requested
            ride_request.ride.save()
            # Generate Booking Confirmation
            subject = "Booking Confirmation"
            message = (
                f"<h3>Ride Booking Confirmed</h3>"
                f"<p><strong>Ride ID:</strong> {ride_request.ride.carpoolride_id}</p>"
                f"<p><strong>Passenger:</strong> {ride_request.passenger.fullname}</p>"
                f"<p><strong>Driver:</strong> {ride_request.ride.driver.fullname}</p>"
                f"<p><strong>Origin:</strong> {ride_request.ride.origin['label']}</p>"
                f"<p><strong>Destination:</strong> {ride_request.ride.destination['label']}</p>"
                f"<p><strong>Departure Time:</strong> {ride_request.ride.departure_time}</p>"
                f"<p><strong>Seats Booked:</strong> {ride_request.seats_requested}</p>"
                f"<p><strong>Fare:</strong> KES {fare}</p>"
                f"<p><strong>Booking Time:</strong> {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}</p>"
            )

            # Render templates
            context = {
                'subject': subject,
                'user_name': ride_request.passenger.first_name,
                'message': message,
                'year': timezone.now().year,
            }
            text_content = render_to_string('emails/base_email.txt', context)
            html_content = render_to_string('emails/base_email.html', context)

            # Send email
            email = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=f"DukeRides <{settings.DEFAULT_FROM_EMAIL}>", 
                # from_email=settings.DEFAULT_FROM_EMAIL,
                to=[ride_request.passenger.email],
            )
            email.attach_alternative(html_content, "text/html")
            try:
                email.send()
                logger.info(f"Booking confirmation email sent to {ride_request.passenger.email}")
            except Exception as e:
                logger.error(f"Failed to send booking confirmation email: {str(e)}")
            # Send push notification
            try:
                fcm_token = getattr(ride_request.passenger, "fcm_token", None)
                if fcm_token:
                    from .utils import send_push_notification
                    send_push_notification(
                        token=fcm_token,
                        title="Booking Confirmed",
                        body=f"Your ride from {ride_request.ride.origin['label']} is confirmed!"
                    )
                    logger.info(f"Booking confirmation push notification sent to {ride_request.passenger.id}")
            except Exception as e:
                logger.error(f"Failed to send push notification: {str(e)}")

            return Response({"message": "Ride request accepted and fare held in escrow."}, status=status.HTTP_200_OK)
        else:
            return Response({"error": "Failed to hold funds in escrow."}, status=status.HTTP_400_BAD_REQUEST)




# drivers to reject ride if they want to do so:

"""this is the main to allow drivers to decline passengers to join their carpool"""
from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import RideRequest
import logging

logger = logging.getLogger(__name__)

class DeclineRideRequestView(generics.UpdateAPIView):
    """View for a driver to decline a ride request.
    --Ensures only the ride's driver can reject a request.
    --Prevents modifying a request that was already accepted or declined.
    --Updates the request status to 'declined'.
    --Notifies the passenger via WebSocket.
    """
    queryset = RideRequest.objects.all()
    permission_classes = [IsAuthenticated]

    def update(self, request, *args, **kwargs):
        try:
            ride_request = self.get_object()
        except RideRequest.DoesNotExist:
            logger.warning(f"Ride request {kwargs.get('pk')} not found")
            return Response({"error": "Ride request not found."}, status=status.HTTP_404_NOT_FOUND)

        # Ensure only the driver of the ride can reject requests
        if ride_request.ride.driver != request.user:
            logger.warning(f"User {request.user.id} attempted to decline request {ride_request.ridrequest_id} without permission")
            return Response({"error": "Only the ride driver can reject requests."}, status=status.HTTP_403_FORBIDDEN)

        # Prevent modifying a request that was already accepted or declined
        if ride_request.status in ["accepted", "declined"]:
            logger.warning(f"Ride request {ride_request.ridrequest_id} already processed with status {ride_request.status}")
            return Response({"error": "This request has already been processed."}, status=status.HTTP_400_BAD_REQUEST)

        # Mark the request as declined
        ride_request.status = "declined"
        ride_request.save()
        logger.info(f"Ride request {ride_request.ridrequest_id} declined by driver {request.user.id}")

        # Notify the passenger
        notification = Notification.objects.create(
            user=ride_request.passenger,
            message=f"Your ride request for ride {ride_request.ride.carpoolride_id} has been declined by the driver.",
            carpoolride_id=str(ride_request.ride.carpoolride_id),
            type="declined",
            is_new=True
        )
        channel_layer = get_channel_layer()
        try:
            async_to_sync(channel_layer.group_send)(
                f"user_{ride_request.passenger.id}",
                {
                    "type": "send_notification",
                    "user_id": str(ride_request.passenger.id),
                    "message": notification.message,
                    "carpoolride_id": str(ride_request.ride.carpoolride_id),
                    "notification_id": str(notification.notification_id),
                    "notification_type": "declined",
                    "time": timezone.now().isoformat()
                }
            )
            logger.info(f"WebSocket notification sent to passenger {ride_request.passenger.id} for ride {ride_request.ride.carpoolride_id}")
        except Exception as e:
            logger.error(f"WebSocket notification failed for passenger {ride_request.passenger.id}: {str(e)}")
            # Fallback to Firebase (optional)
            try:
                fcm_token = getattr(ride_request.passenger, "fcm_token", None)
                if fcm_token:
                    from .utils import send_push_notification
                    send_push_notification(
                        token=fcm_token,
                        title="Ride Request Declined",
                        body=notification.message
                    )
                    logger.info(f"Firebase notification sent to passenger {ride_request.passenger.id}")
            except Exception as e:
                logger.error(f"Firebase notification failed for passenger {ride_request.passenger.id}: {str(e)}")

        return Response({"message": "Ride request declined."}, status=status.HTTP_200_OK)



        
# driver to update their location
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
# from .models import DriverLocation

from geopy.distance import geodesic
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from .models import UserLocation, RideRequest, CarpoolRide
from .utils import notify_user


class UpdateDriverLocationView(APIView):
    permission_classes = [IsAuthenticated]
    """where driver location is updated"""
    def post(self, request):
        user = request.user
        latitude = request.data.get("latitude")
        longitude = request.data.get("longitude")
        ride_id = request.data.get("ride_id")
        is_simulated = request.data.get("is_simulated", False)  # New field for simulation

        print(f"Received location update request: user={user.id}, ride_id={ride_id}, lat={latitude}, lng={longitude}, is_simulated={is_simulated}")

        if not latitude or not longitude or not ride_id:
            print("Missing required fields")
            return Response({"error": "Latitude, longitude, and ride_id are required."}, status=400)

        try:
            ride = CarpoolRide.objects.get(
                carpoolride_id=ride_id,
                driver=user,
                status="in_progress"
            )
        except CarpoolRide.DoesNotExist:
            print(f"No active ride found for user={user.id}, ride_id={ride_id}")
            return Response({"error": "You are not assigned to an active ride with this ID."}, status=403)

        # Update or create location
        try:
            location, created = UserLocation.objects.update_or_create(
                user=user,
                ride=ride,
                defaults={
                    "latitude": latitude,
                    "longitude": longitude,
                    "is_simulated": is_simulated  # Support for simulation
                }
            )
            action = "created" if created else "updated"
            print(f"UserLocation {action}: user={user.id}, ride_id={ride_id}, lat={latitude}, lng={longitude}, is_simulated={is_simulated}, updated_at={location.updated_at}")
        except Exception as e:
            print(f"Error updating UserLocation: user={user.id}, ride_id={ride_id}, error={str(e)}")
            return Response({"error": "Failed to update location."}, status=500)

        # Notify passengers if driver is near (only for non-simulated locations)
        if not is_simulated:
            for ride_request in RideRequest.objects.filter(ride=ride, status="accepted"):
                pickup_coords = (ride_request.pickup_location["lat"], ride_request.pickup_location["lng"])
                driver_coords = (float(latitude), float(longitude))
                distance = geodesic(driver_coords, pickup_coords).km
                print(f"Distance to passenger {ride_request.passenger.id}: {distance} km")
                if distance < 0.5:
                    message = f"Your ride is approaching! Get ready for pickup at {ride_request.pickup_location['label']}."
                    notify_user(ride_request.passenger, message)
                    print(f'ride request passenger being called is: {ride_request.passenger}')
                    print(f"Sent notification to passenger {ride_request.passenger.id} for ride {ride_id}")

        return Response({
            "message": "Driver location updated successfully.",
            "is_simulated": is_simulated
        })
        
#passengers view to see drivers location
from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import RideRequest, CarpoolRide


"""notify passenger when ride starts
    start_ride and complete_ride to use 
    passenger-specific pickup locations in notifications:
"""
class StartRideView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, ride_id):
        try:
            ride = CarpoolRide.objects.get(carpoolride_id=ride_id, driver=request.user)
            if ride.status != "pending":
                return Response({"error": "Ride cannot be started."}, status=status.HTTP_400_BAD_REQUEST)
            
            ride.status = "in_progress"
            ride.save()

            for ride_request in ride.requests.filter(status="accepted"):
                message = f"Your ride from {ride_request.pickup_location} has started!"
                notify_user(ride_request.passenger, message)

            return Response({"message": "Ride started."}, status=status.HTTP_200_OK)
        except CarpoolRide.DoesNotExist:
            return Response({"error": "Ride not found or you are not the driver."}, status=status.HTTP_404_NOT_FOUND)



# passenger dashboard
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import RideRequest, CarpoolRide

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import RideRequest, CarpoolRide, UserLocation
from .serializers import CarpoolRideSerializer
import logging

logger = logging.getLogger(__name__)

class UserDashboardView(APIView):
    """Fetch dashboard details for a passenger, including driver live location for upcoming rides."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        passenger = request.user
        upcoming_rides = CarpoolRide.objects.filter(
            requests__passenger=passenger,
            requests__status="accepted",
            is_completed=False,
            is_cancelled=False
        ).distinct()

        upcoming_rides_data = []
        for ride in upcoming_rides:
            try:
                # Fetch the latest driver location
                location = UserLocation.objects.filter(
                    user=ride.driver,
                    ride=ride
                ).order_by('-updated_at').first()
                driver_location = None
                if location:
                    driver_location = {
                        "user_id": str(ride.driver.id),
                        "latitude": location.latitude,
                        "longitude": location.longitude,
                        "name": ride.driver.fullname,
                        "updated_at": location.updated_at,
                    }

                # Fetch the passenger's ride request
                ride_request = RideRequest.objects.filter(
                    ride=ride,
                    passenger=passenger,
                    status="accepted"
                ).first()
                passenger_request = None
                if ride_request:
                    passenger_request = {
                        "passenger_id": str(ride_request.passenger.id),
                        "passenger_name": ride_request.passenger.fullname,
                        "pickup_location": {
                            "lat": ride_request.pickup_location.get("lat"),
                            "lng": ride_request.pickup_location.get("lng"),
                            "label": ride_request.pickup_location.get("label"),
                        },
                    }

                # Serialize the ride and include additional data
                ride_data = CarpoolRideSerializer(ride).data
                ride_data["driver_location"] = driver_location
                ride_data["passenger_request"] = passenger_request
                upcoming_rides_data.append(ride_data)
            except Exception as e:
                logger.error(f"Error fetching data for ride {ride.carpoolride_id}: {str(e)}")
                ride_data = CarpoolRideSerializer(ride).data
                ride_data["driver_location"] = None
                ride_data["passenger_request"] = None
                upcoming_rides_data.append(ride_data)

        return Response({
            "upcoming_rides": upcoming_rides_data
        })


# passenger getting driver location:from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import CarpoolRide, RideRequest, UserLocation
import logging

logger = logging.getLogger(__name__)

class PassengerDriverLocationView(APIView):
    """passengers get updated driver location"""
    permission_classes = [IsAuthenticated]

    def get(self, request, ride_id):
        try:
            # Check if the user has an accepted ride request for this ride
            ride_request = RideRequest.objects.filter(
                ride__carpoolride_id=ride_id,
                passenger=request.user,
                status="accepted"
            ).first()

            if not ride_request:
                return Response(
                    {"error": "You are not authorized to view this driver's location"},
                    status=403
                )

            # Fetch the latest driver location for this ride
            location = UserLocation.objects.filter(
                user=ride_request.ride.driver,
                carpoolride__carpoolride_id=ride_id
            ).order_by('-updated_at').first()

            if not location:
                # Fallback to latest location if no ride-specific location exists
                location = UserLocation.objects.filter(
                    user=ride_request.ride.driver
                ).order_by('-updated_at').first()
                if not location:
                    return Response(
                        {"error": "Driver location not found"},
                        status=404
                    )

            response_data = {
                "user_id": str(ride_request.ride.driver.id),
                "latitude": location.latitude,
                "longitude": location.longitude,
                "name": ride_request.ride.driver.fullname,
                "updated_at": location.updated_at,
                "is_simulated": location.is_simulated,
                "carpoolride_id": str(location.carpoolride.carpoolride_id) if location.carpoolride else None,
            }
            print(response_data)
            return Response(response_data)

        except CarpoolRide.DoesNotExist:
            return Response(
                {"error": "Ride not found"},
                status=404
            )
        except Exception as e:
            logger.error(f"Error fetching driver location for passenger: {str(e)}")
            return Response(
                {"error": f"Internal server error: {str(e)}"},
                status=500
            )
           
#Passengers Request to Join a Ride (Pending Approval)
# Instead of automatically joining a ride, passengers send a request, and the driver approves or declines.
from django.shortcuts import get_object_or_404
from channels.layers import get_channel_layer
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from .models import CarpoolRide, RideRequest, UserWallet
from .serializers import RideRequestSerializer
import logging

logger = logging.getLogger(__name__)

class RequestToJoinRideView(CreateAPIView):
    """allows passengers to request to join carpool and simultaneously update request ride in 
    driver's dashboard via websocket"""
    serializer_class = RideRequestSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        request_data = self.request.data
        logger.debug(f"Received request data: {request_data}")
        logger.debug(f"Authenticated user: {self.request.user.id}, {self.request.user.fullname}")

        ride_id = request_data.get("ride")
        pickup_location = request_data.get("pickup_location")
        seats_requested = request_data.get("seats_requested", 1)

        if not ride_id or not pickup_location:
            raise ValidationError("Missing ride or pickup location data.")

        try:
            ride = get_object_or_404(CarpoolRide, carpoolride_id=ride_id)
            logger.debug(f"Retrieved ride: {ride.carpoolride_id}")
        except ValueError:
            raise ValidationError("Invalid ride ID format.")

        # Check for existing restricted requests
        existing_request = RideRequest.objects.filter(
            passenger=self.request.user,
            ride=ride,
            status__in=["pending", "canceled", "declined"]
        ).first()
        if existing_request:
            status = existing_request.status
            raise ValidationError(f"You have a {status} request for this ride. Cannot submit another request. Please select another ride")

        # Check wallet balance
        passenger_wallet = UserWallet.objects.get(user=self.request.user)
        logger.debug(f"Passenger wallet balance: {passenger_wallet.balance}")

        fare = ride.contribution_per_seat * int(seats_requested)
        if passenger_wallet.balance < fare:
            raise ValidationError("Insufficient balance to request this ride.")

        ride_request = serializer.save(
            passenger=self.request.user,
            ride=ride,
            pickup_location=pickup_location,
            status="pending"
        )

        # Broadcast the new ride request
        channel_layer = get_channel_layer()
        request_data = {
            'ridrequest_id': str(ride_request.ridrequest_id),
            'passenger_name': self.request.user.fullname,
            'pickup_location': ride_request.pickup_location,
            'seats_requested': ride_request.seats_requested,
            'status': ride_request.status,
            'created_at': ride_request.created_at.isoformat(),
        }
        async_to_sync(channel_layer.group_send)(
            f'ride_{ride_id}',
            {
                'type': 'ride_request_update',
                'request_data': request_data,
            }
        )
        logger.info(f"Broadcasted ride request {ride_request.ridrequest_id} to group ride_{ride_id}")

        
from django.utils import timezone
class PassengerRideRequestListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = RideRequestSerializer

    def get_queryset(self):
        # return RideRequest.objects.filter(passenger=self.request.user)
        return RideRequest.objects.filter(
            passenger=self.request.user,
            ride__status="pending",  # Only pending rides
            ride__is_completed=False,
            ride__is_cancelled=False,
            ride__departure_time__gte=timezone.now()  # Exclude in-progress rides
        ).select_related("ride").order_by('-created_at')







from .utils import notify_user
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.serializers import ValidationError
from django.shortcuts import get_object_or_404
from .models import RideMatch, CarpoolRide, RideRequest, UserWallet
from .serializers import RideRequestSerializer, RideMatchSerializer
class PassengerRideMatchesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        matches = RideMatch.objects.filter(passenger=request.user, status="suggested").select_related("ride", "ride__driver")
        serializer = RideMatchSerializer(matches, many=True)
        return Response(serializer.data)


class AcceptRideMatchView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, match_id):
        print(f"Received request data: {request.data}")  # 🔍 Log incoming data

        try:
            # Retrieve and validate RideMatch
            match = get_object_or_404(
                RideMatch,
                id=match_id,
                passenger=request.user,
                status="suggested"
            )
            ride = match.ride

            # Check seat availability
            if ride.available_seats < 1 or ride.is_full:
                return Response({"error": "No seats available"}, status=400)

            # Check for existing pending request
            if RideRequest.objects.filter(ride=ride, passenger=request.user, status="pending").exists():
                return Response({"error": "You already have a pending request for this ride"}, status=400)

            # Check wallet balance
            passenger_wallet = get_object_or_404(UserWallet, user=request.user)
            if passenger_wallet.balance < ride.fare:
                return Response({"error": "Insufficient balance to request this ride"}, status=400)

            # Validate request data using RideRequestSerializer
            serializer = RideRequestSerializer(data={
                "ride": str(ride.carpoolride_id),
                "pickup_location": request.data.get("pickup_location"),
                "dropoff_location": request.data.get("dropoff_location"),  # Optional
                "seats_requested": request.data.get("seats_requested", 1),
            })
            serializer.is_valid(raise_exception=True)

            # Save RideRequest
            serializer.save(
                passenger=request.user,
                ride=ride,
                status="pending"
            )

            # Update RideMatch status
            match.status = "accepted"
            match.save()

            # Notify driver
            notify_user(
                ride.driver,
                f"{request.user.fullname} has requested to join your ride from {ride.origin['label']}.",
                carpoolride_id=str(ride.carpoolride_id)
            )

            return Response({"message": "Ride request sent to driver"})
        except RideMatch.DoesNotExist:
            return Response({"error": "Match not found"}, status=404)

class DeclineRideMatchView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, match_id):
        try:
            # Retrieve and validate RideMatch
            match = get_object_or_404(
                RideMatch,
                id=match_id,
                passenger=request.user,
                status="suggested"
            )
            ride = match.ride

            # Update RideMatch status to rejected
            match.status = "rejected"
            match.save()

            # Notify passenger (optional)
            notify_user(
                request.user,
                f"You have declined the ride match from {ride.origin['label']} to {ride.destination['label']}.",
                carpoolride_id=str(ride.carpoolride_id)
            )

            return Response({"message": "Ride match declined successfully"})
        except RideMatch.DoesNotExist:
            return Response({"error": "Match not found or already processed"}, status=404)
        

from rest_framework.permissions import AllowAny
from datetime import time, datetime
from django.db.models import Q 


class PassengerCarpoolRideViewSet(ModelViewSet):
    queryset = CarpoolRide.objects.all()
    serializer_class = CarpoolRideSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get']

    def get_queryset(self):
        queryset = super().get_queryset()
        queryset = queryset.filter(
            is_completed=False,
            is_cancelled=False,
            available_seats__gt=0,
            departure_time__gte=timezone.now()
        ).exclude(
            requests__passenger=self.request.user,
            requests__status__in=["pending", "canceled"]
            # requests__status__in=["pending", "canceled", "declined"]
        )
        params = self.request.query_params
        logger.debug(f"Request params: {params}")

        origin = params.get("origin", "").strip()
        if origin:
            queryset = queryset.filter(origin__label__icontains=origin)
            logger.debug(f"Origin filter: {origin}")

        destination = params.get("destination", "").strip()
        if destination:
            queryset = queryset.filter(destination__label__icontains=destination)
            logger.debug(f"Destination filter: {destination}")

        is_women_only = params.get("is_women_only")
        if is_women_only == "true":
            queryset = queryset.filter(is_women_only=True)
        elif is_women_only == "false":
            queryset = queryset.filter(is_women_only=False)

        queryset = queryset.exclude(driver=self.request.user)

        pickup_date = params.get("pickup_date")
        if pickup_date:
            try:
                pickup_date_obj = datetime.strptime(pickup_date, '%Y-%m-%d').date()
                queryset = queryset.filter(departure_time__date=pickup_date_obj)
                logger.debug(f"Pickup date filter: {pickup_date}")
            except ValueError as e:
                logger.warning(f"Invalid pickup_date format: {pickup_date}, error: {e}")
                pass

        time_slot = params.get("time_slot")
        if time_slot and time_slot != "":
            logger.debug(f"Time slot filter: {time_slot}")
            if time_slot == "before_06":
                queryset = queryset.filter(departure_time__time__lt=time(6, 0))
            elif time_slot == "06_12":
                queryset = queryset.filter(departure_time__time__gte=time(6, 0), departure_time__time__lte=time(12, 0))
            elif time_slot == "12_18":
                queryset = queryset.filter(departure_time__time__gte=time(12, 1), departure_time__time__lte=time(18, 0))
            elif time_slot == "after_18":
                queryset = queryset.filter(departure_time__time__gt=time(18, 0))

        return queryset
    
    

"""below version was to be deleted"""

from .models import UserLocation, CarpoolRide
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

class DriverLocationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, ride_id):
        try:
            ride = CarpoolRide.objects.get(carpoolride_id=ride_id, driver=request.user)
            # Fetch latest driver location (adjust based on your UserLocation model)
            location = UserLocation.objects.filter(user=request.user).order_by('-updated_at').first()
            if not location:
                return Response(
                    {'error': 'Driver location not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            return Response({
                'user_id': request.user.id,
                'latitude': location.latitude,
                'longitude': location.longitude,
                'name': request.user.fullname,
            })
        except CarpoolRide.DoesNotExist:
            return Response(
                {'error': 'Ride not found or not authorized'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error fetching driver location: {str(e)}")
            return Response(
                {'error': f'Internal server error: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class GetMapKeyView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # print(f"this is the response")
        return Response({"key": settings.GOOGLE_MAPS_API_KEY})


#deposit funds into wallet balance
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import WalletTransaction, UserWallet, WalletTopUpRequest
import requests
from .utils import get_mpesa_access_token, generate_stk_password, generate_timestamp
from rest_framework import viewsets
from rest_framework.decorators import action
from django.urls import reverse

"""using simulated payment"""
class MockWalletController(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=["post"], url_path="deposit")
    def deposit(self, request):
        user= request.user
        amount = Decimal(request.data.get("amount", 0))
        # phone_number = request.data.get("phone_number")
        phone_number = request.data.get("phone_number", user.phone_number)
        payment_method = request.data.get("payment_method", "mock")
        
        if amount <= 0:
            return Response({"error": "Amount must be greater than zero."}, status=400)

        # Step 1: Create a mock payment
        transaction_id = f"MOCK-{get_random_string(10)}"
        WalletTopUpRequest.objects.create(
            user=request.user,
            amount=amount,
            phone_number=phone_number,
            transaction_id=transaction_id,
            payment_method=payment_method,
            status="pending"
        )

        # Step 2: Simulate callback (internal POST request)
        callback_url = request.build_absolute_uri(reverse("mock-wallet-simulate-callback"))
        callback_payload = {
            "transaction_id": transaction_id,
            "status": "completed",
            "amount": str(amount)
        }

        response = requests.post(callback_url, json=callback_payload)

        return Response({
            "message": f"Top-up simulated via {payment_method}. Callback triggered.",
            "callback_response": response.json(),
            "transaction_id": transaction_id
        })

    @action(detail=False, methods=["post"], url_path="withdraw")
    def withdraw(self, request):
        """for drivers"""
        user = request.user
        amount = Decimal(request.data.get("amount", 0))
        wallet = UserWallet.objects.get(user=request.user)

        if amount <= 0 or wallet.balance < amount:
            return Response({"error": "Invalid or insufficient amount"}, status=400)

        with transaction.atomic():
            wallet.balance -= amount
            wallet.save()
            reference = f"WDR-{get_random_string(10)}"
            WalletTransaction.objects.create(
                user=request.user,
                amount=amount,
                transaction_type="withdrawal",
                status="completed",
                reference=reference
            )

        return Response({
        "message": "Mock withdrawal successful",
        "amount": str(amount),
        "to_phone": user.phone_number,  # 👈 Here's where we include it
        "reference": reference
    }, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], permission_classes=[AllowAny], url_path="simulate-callback")
    def simulate_callback(self, request):
        """when passengers make payment"""
        transaction_id = request.data.get("transaction_id")
        status_value = request.data.get("status")
        amount = Decimal(request.data.get("amount", 0))

        try:
            payment = WalletTopUpRequest.objects.get(transaction_id=transaction_id)
            if status_value == "completed" and payment.status != "completed":
                payment.status = "completed"
                payment.save()

                wallet = payment.user.wallet
                wallet.deposit(amount)

                WalletTransaction.objects.create(
                    user=payment.user,
                    amount=amount,
                    transaction_type="deposit",
                    status="completed",
                    reference=transaction_id
                )

            return Response({"message": "Mock callback processed"})

        except Payment.DoesNotExist:
            return Response({"error": "Payment not found"}, status=404)

    #Paying for a Ride from the Wallet
"""When a user books a ride, the fare is deducted from their wallet balance instead of using M-Pesa directly."""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from decimal import Decimal
from .models import CarpoolRide, UserWallet, WalletTransaction, Payment


# mock-callback
class WalletTopUpCallbackView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        transaction_id = request.data.get("transaction_id")
        status = request.data.get("status")
        amount = request.data.get("amount")

        try:
            payment = Payment.objects.get(transaction_id=transaction_id)
            if status == "completed" and payment.status != "completed":
                payment.status = "completed"
                payment.save()

                wallet = payment.user.wallet
                wallet.deposit(amount)

                WalletTransaction.objects.create(
                    user=payment.user,
                    amount=amount,
                    transaction_type="deposit",
                    status="completed",
                    reference=transaction_id
                )

            return Response({"message": "Mock payment processed."})
        except Payment.DoesNotExist:
            return Response({"error": "Payment not found."}, status=404)

class PayForRideWithWalletView(APIView):
    """official for paying for ride with wallet"""
    permission_classes = [IsAuthenticated]

    def post(self, request, ride_id):
        user = request.user
        try:
            ride = CarpoolRide.objects.get(id=ride_id)
        except CarpoolRide.DoesNotExist:
            return Response({"error": "Ride not found"}, status=404)

        # Assume fare is a field in CarpoolRide or passed in request
        fare = Decimal(request.data.get("fare", ride.fare))  # Add fare to CarpoolRide model if needed

        wallet, _ = UserWallet.objects.select_for_update().get_or_create(user=user)

        if wallet.balance < fare:
            return Response({"error": "Insufficient wallet balance"}, status=400)

        with transaction.atomic():
            wallet.balance -= fare
            wallet.save()
            WalletTransaction.objects.create(
                user=user,
                amount=fare,
                transaction_type="ride_payment",
                status="completed",
                reference=f"RIDE-{ride_id}",
            )

        return Response({"message": "Ride payment successful from wallet."})
    #Releasing Payment to Driver’s Wallet
"""Once a ride is completed, funds are transferred from the passenger’s wallet to the driver’s wallet."""
class ReleaseRidePaymentToDriverView(APIView):
    def post(self, request, ride_id):
        try:
            ride = CarpoolRide.objects.get(id=ride_id)
            passenger_wallet = UserWallet.objects.get(user=ride.passenger)
            driver_wallet, _ = UserWallet.objects.get_or_create(user=ride.driver)

            # Transfer funds from passenger to driver
            driver_wallet.balance += ride.fare
            passenger_wallet.save()
            driver_wallet.save()

            # Log transaction
            WalletTransaction.objects.create(
                user=ride.driver, amount=ride.fare, transaction_type="ride_earnings", status="completed"
            )

            return Response({"message": "Payment released to driver’s wallet."})
        except Exception as e:
            return Response({"error": str(e)}, status=400)

# Driver Withdraws Funds to M-Pesa
"""Drivers can withdraw their earnings from their in-app wallet to M-Pesa anytime."""

"""Users can file disputes for transactions or rides."""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import CarpoolRide, WalletTransaction




"""This will allow users to:
Deposit funds into their wallet (e.g., via M-Pesa)
Withdraw funds from their wallet"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .models import UserWallet, WalletTransaction
from django.utils.crypto import get_random_string
from decimal import Decimal

class DepositWalletView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """User deposits money into their wallet."""
        amount = request.data.get("amount")

        if not amount or Decimal(amount) <= 0:
            return Response({"error": "Invalid amount"}, status=status.HTTP_400_BAD_REQUEST)

        wallet, _ = UserWallet.objects.get_or_create(user=request.user)

        # Simulate payment gateway confirmation (replace with M-Pesa API later)
        reference = f"DEP-{get_random_string(10)}"
        WalletTransaction.objects.create(
            user=request.user,
            amount=amount,
            transaction_type="deposit",
            status="completed",
            reference=reference
        )

        wallet.deposit(Decimal(amount))

        return Response({"message": "Deposit successful", "reference": reference}, status=status.HTTP_200_OK)

class WithdrawWalletView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """User withdraws money from their wallet."""
        amount = request.data.get("amount")

        if not amount or Decimal(amount) <= 0:
            return Response({"error": "Invalid amount"}, status=status.HTTP_400_BAD_REQUEST)

        wallet, _ = UserWallet.objects.get_or_create(user=request.user)

        if wallet.balance < Decimal(amount):
            return Response({"error": "Insufficient balance"}, status=status.HTTP_400_BAD_REQUEST)

        # Simulate withdrawal processing
        reference = f"WDR-{get_random_string(10)}"
        WalletTransaction.objects.create(
            user=request.user,
            amount=amount,
            transaction_type="withdrawal",
            status="pending",
            reference=reference
        )

        # Deduct balance (in real case, only after withdrawal confirmation)
        wallet.balance -= Decimal(amount)
        wallet.save()

        return Response({"message": "Withdrawal request received", "reference": reference}, status=status.HTTP_200_OK)
from django.utils.timezone import now, timedelta
from django.core.mail import send_mail
from django.utils.crypto import get_random_string
from decimal import Decimal
from django.db import transaction
from django.template.loader import render_to_string
from django.core.mail import EmailMultiAlternatives

"""allows users to send funds to another user
    OFFICIAL transfer of funds that are in the app wallet
"""
class TransferFundsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Transfer funds between users securely."""
        phone_number = request.data.get("phone_number")  # Recipient's phone number
        amount = request.data.get("amount")

        if not phone_number or not amount or Decimal(amount) <= 0:
            return Response({"error": "Invalid request"}, status=status.HTTP_400_BAD_REQUEST)

        # Transfer Limit Check: Prevent rapid multiple transfers
        time_threshold = timezone.now() - timedelta(minutes=5)  # Prevent transfers every 5 min
        recent_transfers = WalletTransaction.objects.filter(
            user=request.user, transaction_type="transfer", created_at__gte=time_threshold
        ).count()

        if recent_transfers >= 3:  # Limit: Max 3 transfers in 5 min
            return Response({"error": "Transfer limit reached. Try again later."}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        try:
            with transaction.atomic():  # Start transaction
                # Lock sender and recipient wallets
                sender_wallet = UserWallet.objects.select_for_update().get(user=request.user)
                
                try:
                    recipient_wallet = UserWallet.objects.select_for_update().get(user__phone_number=phone_number)
                except UserWallet.DoesNotExist:
                    return Response({"error": "Recipient not found"}, status=status.HTTP_404_NOT_FOUND)

                if sender_wallet.balance < Decimal(amount):
                    return Response({"error": "Insufficient balance"}, status=status.HTTP_400_BAD_REQUEST)

                reference = f"TRF-{get_random_string(10)}"

                # Update wallet balances
                sender_wallet.balance -= Decimal(amount)
                sender_wallet.save()

                recipient_wallet.balance += Decimal(amount)
                recipient_wallet.save()

                # Create transaction record
                WalletTransaction.objects.create(
                    user=request.user,
                    recipient=recipient_wallet.user,
                    sender_name=request.user.fullname,
                    sender_phone=request.user.phone_number,
                    recipient_name=recipient_wallet.user.fullname,
                    recipient_phone=recipient_wallet.user.phone_number,
                    amount=amount,
                    transaction_type="transfer",
                    status="completed",
                    reference=reference
                )

            # Send Email Notifications (outside transaction for performance)
            # Send Email Notifications
            subject = "Wallet Transfer Confirmation"
            sender_message = (
                f"You have successfully sent KES {amount} to {recipient_wallet.user.fullname}.<br>"
                f"Transaction Reference: {reference}<br>"
                f"Date: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}"
            )
            recipient_message = (
                f"You have received KES {amount} from {request.user.fullname}.<br>"
                f"Transaction Reference: {reference}<br>"
                f"Date: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}"
            )

            context = {
                'subject': subject,
                'year': timezone.now().year,
            }

            # Sender email
            context['user_name'] = request.user.first_name
            context['message'] = sender_message
            text_content = render_to_string('emails/base_email.txt', context)
            html_content = render_to_string('emails/base_email.html', context)
            email = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=f"DukeRides <{settings.DEFAULT_FROM_EMAIL}>", 
                # from_email=settings.DEFAULT_FROM_EMAIL,
                to=[request.user.email],
            )
            email.attach_alternative(html_content, "text/html")
            email.send()
            logger.info(f"Transfer confirmation email sent to {request.user.email}")

            # Recipient email
            context['user_name'] = recipient_wallet.user.first_name
            context['message'] = recipient_message
            text_content = render_to_string('emails/base_email.txt', context)
            html_content = render_to_string('emails/base_email.html', context)
            email = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=f"DukeRides <{settings.DEFAULT_FROM_EMAIL}>", 
                # from_email=settings.DEFAULT_FROM_EMAIL,
                to=[recipient_wallet.user.email],
            )
            email.attach_alternative(html_content, "text/html")
            email.send()
            logger.info(f"Transfer confirmation email sent to {recipient_wallet.user.email}")

            return Response({"message": "Transfer successful", "reference": reference}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": "Transaction failed. Try again later."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
"""This ensures that:
    Money is held in escrow when a ride starts.
    The driver gets paid when the ride is completed.
    Money is refunded if a dispute occurs.
"""
from decimal import Decimal
from Taxi.models import ProfileStats, Report

class CompleteRideView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, ride_id):
        try:
            ride = CarpoolRide.objects.get(carpoolride_id=ride_id, driver=request.user)
        except CarpoolRide.DoesNotExist:
            return Response({"error": "Ride not found or unauthorized"}, status=status.HTTP_404_NOT_FOUND)

        if ride.status == "completed":
            return Response({"error": "Ride has already been completed"}, status=status.HTTP_400_BAD_REQUEST)

        # Mark the ride as completed
        ride.status = "completed"
        ride.is_completed = True
        ride.save()
        
        driver_wallet, _ = UserWallet.objects.get_or_create(user=ride.driver)
        accepted_requests = ride.requests.filter(status="accepted", payment_status="paid")
        
        total_released = Decimal("0.00")
        
        # Update driver stats
        driver_stats, _ = ProfileStats.objects.get_or_create(user=ride.driver)
        driver_stats.total_rides_as_driver += 1

        for req in accepted_requests:
            fare = Decimal(ride.contribution_per_seat) * req.seats_requested
            passenger_wallet = req.passenger.wallet

            if passenger_wallet.escrow_balance >= fare:
                # Deduct from passenger escrow
                passenger_wallet.escrow_balance -= fare
                passenger_wallet.save()

                # Credit to driver wallet
                driver_wallet.balance += fare
                total_released += fare
                
                # Update driver stats with earnings
                driver_stats.total_earnings += fare
                
                # Update passenger stats
                passenger_stats, _ = ProfileStats.objects.get_or_create(user=req.passenger)
                passenger_stats.total_rides_as_passenger += 1
                passenger_stats.save()

                reference = f"ESC-{get_random_string(10)}"
                # Create transaction record
                WalletTransaction.objects.create(
                    user=ride.driver,
                    recipient=req.passenger,
                    amount=fare,
                    transaction_type="escrow_release",
                    status="completed",
                    reference=reference,
                    sender_name=req.passenger.fullname,
                    sender_phone=req.passenger.phone_number,
                    recipient_name=ride.driver.fullname,
                    recipient_phone=ride.driver.phone_number
                )
                # Create Report instance for payment receipt
                report_data = {
                    "ride_id": str(ride.carpoolride_id),
                    "passenger": req.passenger.fullname,
                    "driver": ride.driver.fullname,
                    "amount": str(fare),
                    "transaction_reference": str(reference),
                    "date": timezone.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "status": "completed",
                }
                try:
                    json_data = json.dumps(report_data)
                except TypeError as e:
                    logger.error("Failed to serialize report_data: %s", report_data)
                    raise e  # Or return a response with error for debugging
                
                Report.objects.create(
                    user=req.passenger,
                    report_type="payment_receipt",
                    report_data=report_data,
                    created_at=timezone.now(),
                    file_url=None,  # Set to PDF URL if generated
                )
                
                

        driver_wallet.save()
        driver_stats.save()

        if total_released > 0:
            return Response({
                "message": f"Escrow funds released to driver: {total_released}",
                "total_released": str(total_released)
            }, status=status.HTTP_200_OK)
        # # send email
        # message = (
        #     f"<h3>Payment Receipt</h3>"
        #     f"<p><strong>Ride ID:</strong> {ride.carpoolride_id}</p>"
        #     f"<p><strong>Passenger:</strong> {req.passenger.fullname}</p>"
        #     f"<p><strong>Driver:</strong> {ride.driver.fullname}</p>"
        #     f"<p><strong>Amount:</strong> KES {fare}</p>"
        #     f"<p><strong>Transaction Reference:</strong> {reference}</p>"
        #     f"<p><strong>Date:</strong> {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}</p>"
        # )
        # # Render templates
        #     context = {
        #         'subject': subject,
        #         'user_name': ride_request.passenger.first_name,
        #         'message': message,
        #         'year': timezone.now().year,
        #     }
        #     text_content = render_to_string('emails/base_email.txt', context)
        #     html_content = render_to_string('emails/base_email.html', context)

        #     # Send email
        #     email = EmailMultiAlternatives(
        #         subject=subject,
        #         body=text_content,
        #         from_email=settings.DEFAULT_FROM_EMAIL,
        #         to=[ride_request.passenger.email],
        #     )
        #     email.attach_alternative(html_content, "text/html")
        #     try:
        #         email.send()
        #         logger.info(f"Booking confirmation email sent to {ride_request.passenger.email}")
        #     except Exception as e:
        #         logger.error(f"Failed to send booking confirmation email: {str(e)}")
        
        
        return Response({
            "message": "Ride completed, but no funds were available in escrow to release.",
            "total_released": "0.00"
        }, status=status.HTTP_200_OK)


from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils.crypto import get_random_string
from django.db import transaction
from .models import CarpoolRide, UserWallet, WalletTransaction



class CancelRideView(APIView):
    """If a passenger cancels before the ride starts: Full refund to their wallet.
       If the ride is in progress: Partial refund (50% of contribution).
       If the ride is completed: No refund, but passenger can dispute."""
    permission_classes = [IsAuthenticated]

    def post(self, request, carpoolride_id):
        user = request.user
        logger.info(f"User {user.id} attempting to cancel ride {carpoolride_id}")

        # Fetch the ride request
        try:
            ride_request = RideRequest.objects.get(
                ride__carpoolride_id=carpoolride_id,
                passenger=user,
                status="accepted"
            )
        except RideRequest.DoesNotExist:
            logger.warning(f"No accepted ride request found for user {user.id} and ride {carpoolride_id}")
            return Response(
                {"error": "No accepted ride request found for this ride. Ensure you have an accepted booking."},
                status=status.HTTP_404_NOT_FOUND
            )

        ride = ride_request.ride
        logger.debug(f"Ride {ride.carpoolride_id} status: {ride.status}")

        # Check ride status for refund policy
        if ride.status == "pending":
            refund_amount = ride.contribution_per_seat * ride_request.seats_requested
            refund_status = "full refund"
        elif ride.status == "in_progress":
            refund_amount = (ride.contribution_per_seat * ride_request.seats_requested) * Decimal('0.5')
            refund_status = "partial refund"
        elif ride.status == "completed":
            return Response(
                {"error": "Ride is completed. No refund possible. Contact support for disputes."},
                status=status.HTTP_400_BAD_REQUEST
            )
        else:
            return Response(
                {"error": f"Cannot cancel ride with status '{ride.status}'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Process refund
        reference = None
        if refund_amount > 0:
            try:
                user_wallet, _ = UserWallet.objects.get_or_create(user=user)
                if not user_wallet.refund_escrow(refund_amount):
                    logger.error(f"Refund failed for user {user.id}: Insufficient escrow balance")
                    return Response(
                        {"error": "Refund failed: Insufficient funds in escrow."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                reference = f"REF-{get_random_string(10)}"
                WalletTransaction.objects.create(
                    user=user,
                    amount=refund_amount,
                    transaction_type="escrow_refund",
                    status="completed",
                    reference=reference
                )
                logger.info(f"Refund of {refund_amount} processed for user {user.id}, reference: {reference}")
            except Exception as e:
                logger.error(f"Refund failed for user {user.id}: {str(e)}")
                return Response(
                    {"error": f"Refund processing failed: {str(e)}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        else:
            refund_amount = Decimal('0')
            refund_status = "no refund"
            logger.info(f"No refund issued for user {user.id} (amount: {refund_amount})")

        # Update ride request status
        ride_request.status = "canceled"
        ride_request.payment_status = "refunded" if refund_amount > 0 else ride_request.payment_status
        ride_request.save()
        logger.debug(f"Ride request {ride_request.ridrequest_id} canceled for user {user.id}")

        # Update ride
        ride.available_seats += ride_request.seats_requested
        ride.is_full = False
        # if not ride.requests.filter(status="accepted").exists():
        #     ride.status = "cancelled"
        #     ride.is_cancelled = True
        ride.save()
        logger.debug(f"Ride {ride.carpoolride_id} updated: available_seats={ride.available_seats}, status={ride.status}")

        # Notify the driver via WebSocket
        notification = Notification.objects.create(
            user=ride.driver,
            message=f"Passenger {user.fullname} has canceled their request for ride {carpoolride_id}.",
            carpoolride_id=str(carpoolride_id),
            type="cancellation",
            is_new=True
        )
        channel_layer = get_channel_layer()
        try:
            async_to_sync(channel_layer.group_send)(
                f"user_{ride.driver.id}",
                {
                    "type": "send_notification",
                    "user_id": str(ride.driver.id),
                    "message": notification.message,
                    "carpoolride_id": str(carpoolride_id),
                    "notification_id": str(notification.notification_id),
                    "notification_type": "cancellation",
                    "time": timezone.now().isoformat()
                }
            )
            logger.info(f"WebSocket notification sent to driver {ride.driver.id} for ride {carpoolride_id}")
        except Exception as e:
            logger.error(f"WebSocket notification failed for driver {ride.driver.id}: {str(e)}")
            # Fallback to Firebase
            try:
                fcm_token = getattr(ride.driver, "fcm_token", None)
                if fcm_token:
                    from .utils import send_push_notification
                    send_push_notification(
                        token=fcm_token,
                        title="Ride Cancellation",
                        body=notification.message
                    )
                    logger.info(f"Firebase notification sent to driver {ride.driver.id}")
            except Exception as e:
                logger.error(f"Firebase notification failed for driver {ride.driver.id}: {str(e)}")

        return Response(
            {
                "message": f"Ride request canceled successfully. {refund_status.title()} issued.",
                "refund_amount": str(refund_amount),
                "reference": reference
            },
            status=status.HTTP_200_OK
        )
        


# registeration and authentication
#vehicles
from Taxi.serializers import DriverRegistrationSerializer, VehicleMakeSerializer, VehicleModelSerializer
from Taxi.models import VehicleMake, VehicleModel
from uuid import UUID
class VehicleMakeListView(ListAPIView):
    permission_classes = [AllowAny]
    queryset = VehicleMake.objects.all()
    serializer_class = VehicleMakeSerializer

class VehicleModelListView(ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = VehicleModelSerializer

    def get_queryset(self):
        make_id = self.request.query_params.get("make_id")
        if make_id:
            try:
                # Validate make_id as a UUID
                UUID(make_id)
                return VehicleModel.objects.filter(make__make_id=make_id)
            except ValueError:
                # Invalid UUID format
                return VehicleModel.objects.none()
        return VehicleModel.objects.none()
    
from Taxi.serializers import VehicleSerializer
class DriverVehicleView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            vehicle = Vehicle.objects.get(driver=request.user)
            serializer = VehicleSerializer(vehicle)
            logger.info(f"Fetched vehicle {vehicle.vehicleid} for driver {request.user.id}")
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Vehicle.DoesNotExist:
            logger.warning(f"No vehicle found for driver {request.user.id}")
            return Response({"error": "No vehicle registered for this driver."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error fetching vehicle for driver {request.user.id}: {e}")
            return Response({"error": "An error occurred while fetching the vehicle."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
 #registration
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status
from Taxi.serializers import UserSerializer, registeruserserializer
from Taxi.models import CustomUser
from Taxi.utils import create_token, send_verification_email, send_email
import jwt
from django.db import transaction
from smtplib import SMTPException
from django.db import IntegrityError
import logging
logger = logging.getLogger(__name__)

class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = registeruserserializer(data=request.data)

        if serializer.is_valid():
            try:
                with transaction.atomic():
                    # Save user and deactivate initially
                    user = serializer.save()
                    user.is_active = False
                    user.save()
                    # Debugging: Log the user data
                    logger.info(f"User saved: {user.email}, ID: {user.id}")

                    # Send verification email
                    if not send_verification_email(user):
                        raise SMTPException("Email sending failed.")

                    return Response(
                        {'message': 'User registered successfully. Check your email to verify.'},
                        status=status.HTTP_201_CREATED
                    )
            except IntegrityError as e:
                logger.error(f"Database error: {e}")
                return Response({'error': 'Database error during registration.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            except Exception as e:
                logger.error(f"Error during user registration: {e}")
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

            except SMTPException as e:
                return Response(
                    {'error': 'Registration failed. Email could not be sent.'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            except Exception as e:
                return Response(
                    {'error': str(e)},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# driver registration
from Taxi.serializers import DriverRegistrationSerializer
from rest_framework.parsers import MultiPartParser, FormParser
class DriverRegisterView(APIView):
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        serializer = DriverRegistrationSerializer(data=request.data)

        if serializer.is_valid():
            try:
                with transaction.atomic():
                    # Save driver and deactivate initially
                    driver = serializer.save()
                    driver.is_active = False
                    driver.save()
                    # Debugging: Log the driver data
                    logger.info(f"Driver saved: {driver.email}, ID: {driver.id}")

                    # Send verification email
                    if not send_verification_email(driver):
                        raise SMTPException("Email sending failed.")

                    return Response(
                        {'message': 'Driver registered successfully. Check your email to verify.'},
                        status=status.HTTP_201_CREATED
                    )
            except IntegrityError as e:
                logger.error(f"Database error: {e}")
                return Response(
                    {'error': 'Database error during registration.'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            except SMTPException:
                logger.error("Email sending failed during driver registration")
                return Response(
                    {'error': 'Registration failed. Email could not be sent.'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            except Exception as e:
                logger.error(f"Error during driver registration: {e}")
                return Response(
                    {'error': str(e)},
                    status=status.HTTP_400_BAD_REQUEST
                )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    #verify email
class VerifyEmail(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        token = request.GET.get('token')
        if not token:
            return Response({'error': 'Token not provided'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            
            # Prevent verification if user is already active
            if payload.get('is_active', False):
                return Response({'error': 'User is already active. Invalid token.'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Ensure the token is only valid for inactive users
            user = CustomUser.objects.get(id=payload['id'])
            if user.is_active:
                return Response({'error': 'This token has already been used or the email is already verified.'}, 
                                status=status.HTTP_400_BAD_REQUEST)
            
            if payload.get('verification'):
                user = CustomUser.objects.get(id=payload['id'])
                user.is_active = True
                user.is_email_verified = True
                user.save()
                return Response({'message': 'Email verified successfully'}, status=status.HTTP_200_OK)
            return Response({'error': 'Invalid token'}, status=status.HTTP_400_BAD_REQUEST)
        except jwt.ExpiredSignatureError:
            return Response({'error': 'Token expired'}, status=status.HTTP_400_BAD_REQUEST)
        except jwt.DecodeError:
            return Response({'error': 'Invalid token'}, status=status.HTTP_400_BAD_REQUEST)


    #login
from django.contrib.auth import authenticate, login
from rest_framework_simplejwt.tokens import RefreshToken

 
class LoginView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        # email = request.data.get('email')
        phone_number = request.data.get('phone_number')
        password = request.data.get('password')
        # print(f"this is the phon number:{phone_number} and password sent {password} ")
        # Check if the email exists
        try:
            # user = CustomUser.objects.get(email=email)
            user = CustomUser.objects.get(phone_number=phone_number)
        except CustomUser.DoesNotExist:
            return Response({'error': 'Invalid email address.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check if the password is correct
        # user = authenticate(request, email=email, password=password)
        user = authenticate(request, phone_number=phone_number, password=password)
        if user is not None:
            # #proceed with login
            login(request, user)
            if not hasattr(user, 'wallet'):
                UserWallet.objects.create(user=user)
            
            refresh = RefreshToken.for_user(user)
            return Response({
                "message": "User authenticated successfully",
                "statusCode": status.HTTP_200_OK,
                "access_token": str(refresh.access_token),
                "refresh_token": str(refresh),
                "email": user.email,
                "phone_number":user.phone_number,
                "fullname": user.fullname,
                "id": str(user.id),
                "isAdmin": user.is_staff,
                "is_driver": user.is_driver,
            })

        # If the phone is correct but the password is wrong
        # Check if phone_number exists but password is wrong
        try:
            CustomUser.objects.get(phone_number=phone_number)
            return Response({'error': 'Incorrect password.'}, status=status.HTTP_400_BAD_REQUEST)
        except CustomUser.DoesNotExist:
            return Response({'error': 'Invalid phone number.'}, status=status.HTTP_400_BAD_REQUEST)

# login with google
from django.http import JsonResponse
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from django.contrib.auth import get_user_model
from django.conf import settings
import json
# from google.auth.transport.requests import Request
from django.views.decorators.csrf import csrf_exempt
User = get_user_model()

@csrf_exempt
def google_login(request):
    GOOGLE = settings.GOOGLE_OAUTH2_CLIENT_ID
    if request.method == "POST":
        try:
            data = json.loads(request.body.decode('utf-8'))
            # logger.info(f"this is the data : {data}")
            token = data.get("token")
            logger.info(f"this is the data : {token}")


            if not token:
                return JsonResponse({"error": "Token is required"}, status=400)

            # Verify the token with Google
            google_user = id_token.verify_oauth2_token(
                token,
                google_requests.Request(),
                settings.GOOGLE_OAUTH2_CLIENT_ID 
            )
            
            logger.info(f"this is the google client user {google_user}")
            if not google_user:
                return JsonResponse({"error": "Invalid Google token"}, status=400)

            # Extract user info from Google
            email = google_user["email"]
            google_id = google_user['sub']
            
            # Check if user exists by email
            try:
                user = CustomUser.objects.get(email=email)
                # Update user with Google data if needed
                if not user.google_id:  # Add google_id field to CustomUser
                    user.google_id = google_id
                    user.save()
            except CustomUser.DoesNotExist:
                # Create a new user if no match
                return Response(
                    {"error": "No account associated with this Google email."},
                    status=400
                    )


            # Generate JWT tokens
            refresh = RefreshToken.for_user(user)
            access_token = str(refresh.access_token)
            response_is = {"message": "Login successful",
                "user": {
                    "id": str(user.id),
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "fullname": user.fullname,
                    "phone_number": user.phone_number,
                    # "profile_picture": user.profile_picture.url if user.profile_picture else picture,
                    "gender": user.gender,
                    "is_driver": user.is_driver,
                },
                "access_token": access_token,
                "refresh_token": str(refresh)}
            logger.info(f"this is the response data : {response_is}")
            

            return JsonResponse({
                "message": "Login successful",
                "user": {
                    "id": str(user.id),
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "fullname": user.fullname,
                    "phone_number": user.phone_number,
                    "is_driver": user.is_driver,
                },
                "access_token": access_token,
                "refresh_token": str(refresh)
            }, status=200)

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)

    return JsonResponse({"error": "Invalid request"}, status=400)

    
from Taxi.serializers import PasswordResetSerializer
class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        print(f"this is the request{request}")
        print(f'this is the email{email}')
        try:
            user = CustomUser.objects.get(email=email)
            token = create_token(user, {'reset': True})
            reset_link = f"{settings.FRONTEND_URL}/password-reset/?token={token}"
            subject = "Password Reset Request"
            message = f"Click the link to reset your password: {reset_link}"
            send_email(subject, message, email)
            return Response({'message': 'Password reset email sent'}, status=status.HTTP_200_OK)
        except CustomUser.DoesNotExist:
            return Response({'error': 'User with this email does not exist'}, status=status.HTTP_400_BAD_REQUEST)
    # password request view
class PasswordResetView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.GET.get('token')
        if not token:
            return Response({'error': 'Token not provided'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            if payload.get('reset'):
                try:
                    user = CustomUser.objects.get(id=payload['id'])  # Adjust to user_id if needed
                    serializer = PasswordResetSerializer(data=request.data)
                    if serializer.is_valid():
                        user.set_password(serializer.validated_data['password'])
                        user.save()
                        return Response({'message': 'Password reset successful'}, status=status.HTTP_200_OK)
                    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
                except CustomUser.DoesNotExist:
                    return Response({'error': 'Invalid user'}, status=status.HTTP_400_BAD_REQUEST)
            return Response({'error': 'Invalid token'}, status=status.HTTP_400_BAD_REQUEST)
        except jwt.ExpiredSignatureError:
            return Response({'error': 'Token expired'}, status=status.HTTP_400_BAD_REQUEST)
        except jwt.DecodeError:
            return Response({'error': 'Invalid token'}, status=status.HTTP_400_BAD_REQUEST)
        
    #update fcm
class UpdateFCMTokenView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        user.fcm_token = request.data.get('fcm_token')
        user.save()
        return Response({"message": "FCM token updated"}, status=status.HTTP_200_OK)
#dismiss notification
from Taxi.models import Notification

class DismissNotificationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, notification_id):
        try:
            notification = get_object_or_404(Notification, notification_id=notification_id, user=request.user)
            if not notification.is_new:
                logger.info(f"Notification {notification_id} already dismissed for user {request.user.id}")
                return Response({"message": "Notification already dismissed."}, status=status.HTTP_200_OK)
            notification.is_new = False
            notification.save()
            logger.info(f"Notification {notification_id} dismissed for user {request.user.id}")

            # Broadcast dismissal via WebSocket
            channel_layer = get_channel_layer()
            group_name = f"user_{request.user.id}"
            async_to_sync(channel_layer.group_send)(
                group_name,
                {
                    "type": "notification_dismissed",
                    "notification_id": str(notification.notification_id),
                    "message": "Notification dismissed",
                    "user_id": str(request.user.id),
                }
            )

            return Response({"message": "Notification dismissed successfully."}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error dismissing notification {notification_id} for user {request.user.id}: {str(e)}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    #logout
from django.views.decorators.csrf import csrf_exempt
# @csrf_exempt
class LogoutView(APIView):
    """Accepts a refresh token and blacklists it as a form of logout mechanism"""
    # Must be authenticated
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        refresh_token = request.data.get('refresh_token') or request.data.get('refresh')
        if not refresh_token:
            return Response({'error':'Request token not provided'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            token = RefreshToken(refresh_token)
            #simple-jwt blacklist
            token.blacklist()
            return Response({'message':'User Successfully logged out'}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error':str(e)}, status=status.HTTP_400_BAD_REQUEST)
        
        
#refresh token
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.tokens import TokenError

class CustomTokenRefreshView(TokenRefreshView):
    def post(self, request, *args, **kwargs):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response(
                {'error': 'Refresh token is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            refresh = RefreshToken(refresh_token)
            data = {
                'access_token': str(refresh.access_token),
                'refresh_token': str(refresh)  # New refresh token
            }
            return Response(data)
        except TokenError:  # Catch specific token error
            return Response({'error': 'Invalid or expired refresh token'}, status=status.HTTP_401_UNAUTHORIZED)

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from Taxi.serializers import UserProfileSerializer

from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView as SimpleJWTTokenRefreshView

class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get user profile data"""
        serializer = UserProfileSerializer(request.user, context={'request': request})
        preferences, _ = UserPreferences.objects.get_or_create(user=request.user)
        preferences_serializer = UserPreferencesSerializer(preferences, context={'request': request})
        return Response({
            'profile': serializer.data,
            'preferences': preferences_serializer.data
        }, status=status.HTTP_200_OK)
    
    def patch(self, request):
        """Update user profile data"""
        user = request.user
        serializer = UserProfileSerializer(user, data=request.data, partial=True, context={'request': request})
        
        if serializer.is_valid():
            serializer.save()
            logger.info(f"this is the data {serializer.data}")
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

from Taxi.serializers import UserWalletBalanceSerializer
class UserWalletBalanceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserWalletBalanceSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    
from Taxi.models import UserPreferences
from Taxi.serializers import UserPreferencesSerializer
class UpdateUserPreferencesView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        user = request.user
        preferences, _ = UserPreferences.objects.get_or_create(user=user)
        serializer = UserPreferencesSerializer(preferences, data=request.data, partial=True)
        
        if serializer.is_valid():
            # Check if prefers_women_only_rides is being set to True
            if serializer.validated_data.get('prefers_women_only_rides') and user.gender != 'Female':
                return Response(
                    {"error": "Only female users can prefer women-only rides"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)    


from Taxi.models import Message
from Taxi.serializers import MessageSerializer
class ChatHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, carpoolride_id):
        logger.info(f"Fetching chat history for ride {carpoolride_id} by user {request.user.id}")
        try:
            ride = CarpoolRide.objects.get(carpoolride_id=carpoolride_id)
            is_driver = ride.driver == request.user
            is_passenger = RideRequest.objects.filter(
                ride=ride,
                passenger=request.user,
                status='accepted'
            ).exists()
            if not (is_driver or is_passenger):
                logger.warning(f"User {request.user.id} not authorized for ride {carpoolride_id}")
                return Response({'error': 'You are not authorized for this ride'}, status=status.HTTP_403_FORBIDDEN)
            
            messages = Message.objects.filter(ride=ride).order_by('timestamp')
            serializer = MessageSerializer(messages, many=True)
            logger.info(f"Returning {len(serializer.data)} messages for ride {carpoolride_id}")
            return Response(serializer.data)
        except CarpoolRide.DoesNotExist:
            logger.error(f"Ride {carpoolride_id} not found")
            return Response({'error': 'Ride not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error fetching chat history for ride {carpoolride_id}: {str(e)}")
            return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        

import logging

logger = logging.getLogger(__name__)

class UnreadMessagesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            user = request.user
            if not user.is_authenticated:
                logger.error("Unauthenticated user attempted to access unread messages")
                return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

            # Fetch rides where user is driver or accepted passenger
            rides = CarpoolRide.objects.filter(
                Q(driver=user) |
                Q(requests__passenger=user, requests__status='accepted')
            ).distinct()
            logger.debug(f"Found {rides.count()} rides for user {user.id}")

            unread_counts = []
            for ride in rides:
                # Fetch unread messages for this ride
                messages = Message.objects.filter(
                    ride__carpoolride_id=ride.carpoolride_id,
                    recipient=user,
                    status__in=['sent', 'delivered']
                ).select_related('sender')
                logger.debug(f"Found {messages.count()} unread messages for ride {ride.carpoolride_id}")

                # Group by sender
                sender_counts = {}
                for message in messages:
                    sender_id = str(message.sender.id)
                    sender_counts[sender_id] = sender_counts.get(sender_id, 0) + 1

                # Add counts to response
                for sender_id, count in sender_counts.items():
                    unread_counts.append({
                        'carpoolride_id': str(ride.carpoolride_id),
                        'sender_id': sender_id,
                        'unread_count': count
                    })

            logger.info(f"Returning {len(unread_counts)} unread message counts for user {user.id}")
            return Response(unread_counts, status=status.HTTP_200_OK)

        except CarpoolRide.DoesNotExist:
            logger.warning(f"No rides found for user {user.id}")
            return Response([], status=status.HTTP_200_OK)
        except Message.DoesNotExist:
            logger.warning(f"No messages found for user {user.id}")
            return Response([], status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception(f"Error fetching unread messages for user {user.id}: {str(e)}")
            return Response({'error': f'Internal server error: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ChatReceiverProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        try:
            user = CustomUser.objects.get(id=user_id)
            logger.info(f"Profile fetched for user_id={user_id}")
            
            
            first_name= user.first_name
            last_name= user.last_name

            response_data = {
                "id": str(user.id),
                "first_name": first_name,
                "last_name": last_name,
                "phone_number": user.phone_number,
            }
            logger.info(f"Profile fetched for user_id={user_id} by user={request.user.id}")
            return Response(response_data, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            logger.error(f"User not found for user_id={user_id}")
            return Response({"error": "User not found."}, status=404)
            # raise Http404("User not found")
        except Exception as e:
            logger.error(f"Error fetching profile for user_id={user_id}: {str(e)}")
            return Response({"error": "Internal server error"}, status=500)
        
class TokenRefreshView(SimpleJWTTokenRefreshView):
    permission_classes = [AllowAny]  # Allow anyone to refresh token

# reports
# ridehistory report
from django.http import HttpResponse
from Taxi.serializers import WalletTransactionSerializer, ReportSerializer


class CustomPaginationForReport(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100

class DownloadRideHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    # @cache_page(60 * 15)
    def get(self, request):
        user = request.user
        month = request.query_params.get('month')
        year = request.query_params.get('year')

        rides = CarpoolRide.objects.filter(
            Q(driver=user) | Q(requests__passenger=user),
            is_cancelled=False
        ).select_related('driver', 'vehicle').prefetch_related('requests__passenger').distinct().order_by('-last_updated')   #.order_by('departure_time')

        filter_applied = False
        error_message = None

        if year:
            try:
                year = int(year)
                rides = rides.filter(departure_time__year=year)
                filter_applied = True
                if month:
                    try:
                        month = int(month)
                        if not (1 <= month <= 12):
                            context = {
                                'user': user,
                                'rides': [],
                                'report_generated_at': timezone.now(),
                                'year': timezone.now().year,
                                'filter_month': month,
                                'filter_year': year,
                                'error_message': 'Invalid month value. Please select a valid month.',
                            }
                            return HttpResponse(
                                render_to_string('reports/ride_history.html', context),
                                content_type='text/html'
                            )
                        rides = rides.filter(departure_time__month=month)
                    except ValueError:
                        context = {
                            'user': user,
                            'rides': [],
                            'report_generated_at': timezone.now(),
                            'year': timezone.now().year,
                            'filter_month': month,
                            'filter_year': year,
                            'error_message': 'Invalid month format.',
                        }
                        return HttpResponse(
                            render_to_string('reports/ride_history.html', context),
                            content_type='text/html'
                        )
            except ValueError:
                context = {
                    'user': user,
                    'rides': [],
                    'report_generated_at': timezone.now(),
                    'year': timezone.now().year,
                    'filter_month': month,
                    'filter_year': year,
                    'error_message': 'Invalid year format.',
                }
                return HttpResponse(
                    render_to_string('reports/ride_history.html', context),
                    content_type='text/html'
                )

        rides_data = [
            {
                'carpoolride_id': str(ride.carpoolride_id),
                'origin_label': ride.origin.get('label', 'N/A'),
                'destination_label': ride.destination.get('label', 'N/A'),
                'departure_time': ride.departure_time,
                'contribution_per_seat': ride.contribution_per_seat,
                'status': ride.status,
            }
            for ride in rides
        ]

        report_data = {
            "user_id": str(user.id),
            "ride_count": len(rides_data),
            "format": "html",
            "generated_at": timezone.now().strftime("%Y-%m-%d %H:%M:%S"),
            "month": month or "all",
            "year": year or str(timezone.now().year),
        }
        report = Report.objects.create(
            user=user,
            report_type="ride_history",
            report_data=report_data,
            created_at=timezone.now(),
            file_url=None,
        )

        try:
            context = {
                'user': user,
                'rides': rides_data,
                'report_generated_at': timezone.now(),
                'year': timezone.now().year,
                'filter_month': month,
                'filter_year': year,
                'error_message': 'No rides found for the selected period.' if filter_applied and not rides_data else None,
            }
            html_content = render_to_string('reports/ride_history.html', context)
            logger.info(f"Ride history report generated for user {user.id}, month={month}, year={year}")
            return HttpResponse(html_content, content_type='text/html')
        except Exception as e:
            logger.error(f"Error generating ride history report for user {user.id}: {str(e)}")
            context = {
                'user': user,
                'rides': [],
                'report_generated_at': timezone.now(),
                'year': timezone.now().year,
                'filter_month': month,
                'filter_year': year,
                'error_message': 'Failed to generate report. Please try again.',
            }
            html_content = render_to_string('reports/ride_history.html', context)
            return HttpResponse(html_content, content_type='text/html')



# consider if formal pdf similar to how invoice are presented 
# from reportlab.pdfgen import canvas
# from reportlab.lib import colors
# from reportlab.lib.pagesizes import letter
# from reportlab.platypus import SimpleDocTemplate, Table, TableStyle
# import csv
# from io import BytesIO
# class DownloadRideHistoryView(APIView):
#     permission_classes = [IsAuthenticated]

#     def get(self, request, format='pdf'):
#         user = request.user
#         rides = RideHistoryView().get_queryset().filter(Q(driver=user) | Q(requests__passenger=user))

#         if not rides:
#             logger.warning(f"No rides found for user {user.id} in DownloadRideHistoryView")
#             return Response({"error": "No ride history available"}, status=404)

#         # Store report in Report model
#         report_data = {
#             "user_id": user.id,
#             "ride_count": rides.count(),
#             "format": format,
#             "generated_at": timezone.now().strftime("%Y-%m-%d %H:%M:%S"),
#         }
#         report = Report.objects.create(
#             user=user,
#             report_type="ride_history",
#             report_data=report_data,
#             created_at=timezone.now(),
#             file_url=None,  # Update with actual file URL if stored
#         )

#         try:
#             if format == 'pdf':
#                 buffer = BytesIO()
#                 doc = SimpleDocTemplate(buffer, pagesize=letter)
#                 elements = []

#                 # Create table data
#                 data = [['Ride ID', 'Origin', 'Destination', 'Departure Time', 'Fare']]
#                 for ride in rides:
#                     data.append([
#                         ride.carpoolride_id,
#                         ride.origin.get('label', 'N/A'),
#                         ride.destination.get('label', 'N/A'),
#                         str(ride.departure_time),
#                         f"KES {ride.contribution_per_seat}",
#                     ])

#                 # Create table
#                 table = Table(data)
#                 table.setStyle(TableStyle([
#                     ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
#                     ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
#                     ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
#                     ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
#                     ('FONTSIZE', (0, 0), (-1, 0), 12),
#                     ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
#                     ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
#                     ('GRID', (0, 0), (-1, -1), 1, colors.black),
#                 ]))
#                 elements.append(table)

#                 # Build PDF
#                 doc.build(elements)
#                 buffer.seek(0)
#                 response = HttpResponse(buffer, content_type='application/pdf')
#                 response['Content-Disposition'] = f'attachment; filename="ride_history_{user.id}.pdf"'
#                 logger.info(f"Ride history PDF generated for user {user.id}")
#                 return response

#             elif format == 'csv':
#                 response = HttpResponse(content_type='text/csv')
#                 response['Content-Disposition'] = f'attachment; filename="ride_history_{user.id}.csv"'
#                 writer = csv.writer(response)
#                 writer.writerow(['Ride ID', 'Origin', 'Destination', 'Departure Time', 'Fare'])
#                 for ride in rides:
#                     writer.writerow([
#                         ride.carpoolride_id,
#                         ride.origin.get('label', 'N/A'),
#                         ride.destination.get('label', 'N/A'),
#                         ride.departure_time,
#                         ride.contribution_per_seat,
#                     ])
#                 logger.info(f"Ride history CSV generated for user {user.id}")
#                 return response

#             else:
#                 logger.error(f"Invalid format requested: {format}")
#                 return Response({"error": "Invalid format"}, status=400)

#         except Exception as e:
#             logger.error(f"Error generating ride history report for user {user.id}: {str(e)}")
#             return Response({"error": "Failed to generate report"}, status=500)


from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum
from datetime import datetime
class PaymentReceiptView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        month = request.query_params.get('month')
        year = request.query_params.get('year')

        transactions = WalletTransaction.objects.filter(
            Q(user=user) | Q(recipient=user),
            status="completed",
            transaction_type__in=["escrow_hold", "transfer", "ride_payment", "deposit", "escrow_refund" ]
        ).select_related('user', 'recipient').distinct().order_by('-created_at')
        logger.info(f"these are the transactions found for this user's {user.id} paymentment receipt: {transactions} ")
        filter_applied = False
        error_message = None

        if year:
            try:
                year = int(year)
                transactions = transactions.filter(created_at__year=year)
                filter_applied = True
                if month:
                    try:
                        month = int(month)
                        if not (1 <= month <= 12):
                            context = {
                                'user': user,
                                'transactions': [],
                                'report_generated_at': timezone.now(),
                                'year': timezone.now().year,
                                'filter_month': month,
                                'filter_year': year,
                                'error_message': 'Invalid month value. Please select a valid month.',
                            }
                            return HttpResponse(
                                render_to_string('reports/payment_receipt.html', context),
                                content_type='text/html'
                            )
                        transactions = transactions.filter(created_at__month=month)
                    except ValueError:
                        context = {
                            'user': user,
                            'transactions': [],
                            'report_generated_at': timezone.now(),
                            'year': timezone.now().year,
                            'filter_month': month,
                            'filter_year': year,
                            'error_message': 'Invalid month format.',
                        }
                        return HttpResponse(
                            render_to_string('reports/payment_receipt.html', context),
                            content_type='text/html'
                        )
            except ValueError:
                context = {
                    'user': user,
                    'transactions': [],
                    'report_generated_at': timezone.now(),
                    'year': timezone.now().year,
                    'filter_month': month,
                    'filter_year': year,
                    'error_message': 'Invalid year format.',
                }
                return HttpResponse(
                    render_to_string('reports/payment_receipt.html', context),
                    content_type='text/html'
                )
        SPENDING_TYPE_LABELS = {
            "escrow_hold": "Ride Payment",
            "transfer": "Friend Transfer",
            "escrow_refund": "Refund",
            "deposit":"Deposit",
            "ride_payment": "Ride Payment"
            }

        transactions_data = [
            {
                'transaction_id': str(transaction.walletTransactionid),
                'amount': transaction.amount,
                'spending_type': SPENDING_TYPE_LABELS.get(transaction.transaction_type, "Other"),
                'transaction_type': transaction.transaction_type or 'n/a',
                'reference': transaction.reference or 'N/A',
                'sender_name': transaction.sender_name or 'N/A',
                'recipient_name': transaction.recipient_name or 'Credit',
                'created_at': transaction.created_at,
                'status': transaction.status,
                'ride_id': getattr(transaction, 'ride_id', 'N/A'),  # Handle missing ride_id
            }
            for transaction in transactions
        ]
        logger.info(f"this is what transaction data is {transactions_data}")

        report_data = {
            "user_id": str(user.id),
            "transaction_count": len(transactions_data),
            "format": "html",
            "generated_at": timezone.now().strftime("%Y-%m-%d %H:%M:%S"),
            "month": month or "all",
            "year": year or str(timezone.now().year),
        }
        report = Report.objects.create(
            user=user,
            report_type="payment_receipt",
            report_data=report_data,
            created_at=timezone.now(),
            file_url=None,
        )

        try:
            context = {
                'user': user,
                'transactions': transactions_data,
                'report_generated_at': timezone.now(),
                'year': timezone.now().year,
                'filter_month': month,
                'filter_year': year,
                'error_message': 'No payment receipts found for the selected period.' if filter_applied and not transactions_data else None,
            }
            html_content = render_to_string('reports/payment_receipt.html', context)
            logger.info(f"Payment receipt report generated for user {user.id}, month={month}, year={year}")
            return HttpResponse(html_content, content_type='text/html')
        except Exception as e:
            logger.error(f"Error generating payment receipt report for user {user.id}: {str(e)}")
            context = {
                'user': user,
                'transactions': [],
                'report_generated_at': timezone.now(),
                'year': timezone.now().year,
                'filter_month': month,
                'filter_year': year,
                'error_message': 'Failed to generate report. Please try again.',
            }
            html_content = render_to_string('reports/payment_receipt.html', context)
            return HttpResponse(html_content, content_type='text/html')
class PassengerSpendingView(APIView):
    permission_classes = [IsAuthenticated]

    # @cache_page(60 * 15)
    def get(self, request):
        user = request.user
        month = request.query_params.get('month')
        year = request.query_params.get('year')
        
        transactions = WalletTransaction.objects.filter(
            user=user,
            status="completed",
            transaction_type__in=["escrow_hold", "transfer", "ride_payment", "deposit", "escrow_refund" ]
            
        ).select_related('user', 'recipient').distinct().order_by("-created_at")
        
        if year:
            try:
                year = int(year)
                transactions = transactions.filter(created_at__year=year)
                filter_applied = True
                if month:
                    try:
                        month = int(month)
                        if not (1 <= month <= 12):
                            context = {
                                'user': user,
                                'transactions': [],
                                'report_generated_at': timezone.now(),
                                'year': timezone.now().year,
                                'filter_month': month,
                                'filter_year': year,
                                'error_message': 'Invalid month value. Please select a valid month.',
                            }
                            return HttpResponse(
                                render_to_string('reports/payment_receipt.html', context),
                                content_type='text/html'
                            )
                        transactions = transactions.filter(created_at__month=month)
                    except ValueError:
                        context = {
                            'user': user,
                            'transactions': [],
                            'report_generated_at': timezone.now(),
                            'year': timezone.now().year,
                            'filter_month': month,
                            'filter_year': year,
                            'error_message': 'Invalid month format.',
                        }
                        return HttpResponse(
                            render_to_string('reports/payment_receipt.html', context),
                            content_type='text/html'
                        )
            except ValueError:
                context = {
                    'user': user,
                    'transactions': [],
                    'report_generated_at': timezone.now(),
                    'year': timezone.now().year,
                    'filter_month': month,
                    'filter_year': year,
                    'error_message': 'Invalid year format.',
                }
                return HttpResponse(
                    render_to_string('reports/payment_receipt.html', context),
                    content_type='text/html'
                )
        SPENDING_TYPE_LABELS = {
            "escrow_hold": "Ride Payment",
            "transfer": "Friend Transfer",
            "escrow_refund": "Refund",
            "deposit":"Deposit",
            "ride_payment": "Ride Payment"
            }

        spending_data = [
            {
                'transaction_id': str(transaction.walletTransactionid),
                'spending_type': SPENDING_TYPE_LABELS.get(transaction.transaction_type, "Other"),
                'amount': transaction.amount,
                'trans_type':transaction.transaction_type,
                'reference': transaction.reference,
                'recipient_name': transaction.recipient_name or 'Credit',
                'created_at': transaction.created_at,   
            }
            for transaction in transactions
        ]

        report_data = {
            "user_id": str(user.id),
            "transaction_count": len(spending_data),
            "format": "html",
            "generated_at": timezone.now().strftime("%Y-%m-%d %H:%M:%S"),
        }
        report = Report.objects.create(
            user=user,
            report_type="passenger_spending",
            report_data=report_data,
            created_at=timezone.now(),
            file_url=None,
        )

        try:
            context = {
                'user': user,
                'spending': spending_data,
                'report_generated_at': timezone.now(),
                'year': timezone.now().year,
            }
            html_content = render_to_string('reports/passenger_spending.html', context)
            logger.info(f"Passenger spending report generated for user {user.id}")
            return HttpResponse(html_content, content_type='text/html')
        except Exception as e:
            logger.error(f"Error generating passenger spending report for user {user.id}: {str(e)}")
            return Response({"error": "Failed to generate report"}, status=500)
class DriverEarningsView(APIView):
    permission_classes = [IsAuthenticated]

    # @cache_page(60 * 15)
    def get(self, request):
        user = request.user
        if not user.is_driver:
            return Response({"error": "Only drivers can access earnings report"}, status=403)
        
        month = request.query_params.get('month')
        year = request.query_params.get('year')
        
        rides = CarpoolRide.objects.filter(
            driver=user,
            status="completed",
            is_cancelled=False
        ).select_related('driver').prefetch_related('requests__passenger')
        
        if year:
            try:
                year = int(year)
                # transactions = transactions.filter(created_at__year=year)
                rides = rides.filter(departure_time__year=year)
                filter_applied = True
                if month:
                    try:
                        month = int(month)
                        if not (1 <= month <= 12):
                            context = {
                                'user': user,
                                'rides': [],
                                'report_generated_at': timezone.now(),
                                'year': timezone.now().year,
                                'filter_month': month,
                                'filter_year': year,
                                'error_message': 'Invalid month value. Please select a valid month.',
                            }
                            return HttpResponse(
                                render_to_string('reports/payment_receipt.html', context),
                                content_type='text/html'
                            )
                        # transactions = transactions.filter(created_at__month=month)
                        rides = rides.filter(departure_time__month=month)
                    except ValueError:
                        context = {
                            'user': user,
                            'rides': [],
                            'report_generated_at': timezone.now(),
                            'year': timezone.now().year,
                            'filter_month': month,
                            'filter_year': year,
                            'error_message': 'Invalid month format.',
                        }
                        return HttpResponse(
                            render_to_string('reports/payment_receipt.html', context),
                            content_type='text/html'
                        )
            except ValueError:
                context = {
                    'user': user,
                    'rides': [],
                    'report_generated_at': timezone.now(),
                    'year': timezone.now().year,
                    'filter_month': month,
                    'filter_year': year,
                    'error_message': 'Invalid year format.',
                }
                return HttpResponse(
                    render_to_string('reports/payment_receipt.html', context),
                    content_type='text/html'
                )

        earnings_data = []

        for ride in rides:
            accepted_requests = ride.requests.filter(status="accepted", payment_status="paid").select_related("passenger")
            passengers = [
                {
                    "name": req.passenger.fullname,
                    "phone": req.passenger.phone_number,
                    "seats_booked": req.seats_requested,
                    "amount_paid": float(ride.contribution_per_seat) * req.seats_requested,
                }
                for req in accepted_requests
            ]

            earnings_data.append({
                "carpoolride_id": str(ride.carpoolride_id),
                "origin": ride.origin.get("label", "Unknown"),
                "destination": ride.destination.get("label", "Unknown"),
                "total_amount_paid": ride.total_amount_paid,
                "departure_time": ride.departure_time,
                "passenger_count": accepted_requests.count(),
                "passenger_breakdown": passengers,
            })
        report_data = {
            "user_id": str(user.id),
            "ride_count": len(earnings_data),
            "format": "html",
            "generated_at": timezone.now().strftime("%Y-%m-%d %H:%M:%S"),
        }
        report = Report.objects.create(
            user=user,
            report_type="driver_earnings",
            report_data=report_data,
            created_at=timezone.now(),
            file_url=None,
        )

        try:
            context = {
                'user': user,
                'earnings': earnings_data,
                'report_generated_at': timezone.now(),
                'year': timezone.now().year,
            }
            html_content = render_to_string('reports/driver_earnings.html', context)
            logger.info(f"Driver earnings report generated for user {user.id}")
            return HttpResponse(html_content, content_type='text/html')
        except Exception as e:
            logger.error(f"Error generating driver earnings report for user {user.id}: {str(e)}")
            return Response({"error": "Failed to generate report"}, status=500)

class UserReportsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        report_type = request.query_params.get('report_type')
        report_views = {
            'ride_history': RideHistoryView.as_view(),
            'payment_receipt': PaymentReceiptView.as_view(),
            'driver_earnings': DriverEarningsView.as_view(),
            'passenger_spending': PassengerSpendingView.as_view(),
        }

        if report_type not in report_views:
            logger.warning(f"Invalid report_type requested: {report_type} by user {request.user.id}")
            return Response({"error": "Invalid report type"}, status=400)

        try:
            # Store report access in Report model
            Report.objects.create(
                user=request.user,
                report_type=report_type,
                report_data={"report_accessed": report_type, "generated_at": timezone.now().strftime("%Y-%m-%d %H:%M:%S")},
                created_at=timezone.now(),
                file_url=None,
            )

            # Call the appropriate view
            view = report_views[report_type]
            response = view(request._request)
            logger.info(f"Report {report_type} accessed by user {request.user.id}")
            return response

        except Exception as e:
            logger.error(f"Error accessing report {report_type} for user {request.user.id}: {str(e)}")
            return Response({"error": "Failed to generate report"}, status=500)

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
        })

        #to list ride requests for the driver
from Taxi.serializers import RideRequestSerializer, CarpoolRideSerializer
from Taxi.models import CarpoolRide
from rest_framework.viewsets import ModelViewSet
class DriverRideRequestsView(ListAPIView):
    serializer_class = RideRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return RideRequest.objects.filter(ride__driver=self.request.user,
                                          ride__status__in=['pending', 'in_progress']
                                          ).order_by('-created_at')
    
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
            raise ValidationError("You already have an active ride in progress or pending. Please complete it before creating a new one.")
        
        # serializer.save(driver=self.request.user)
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
        # departure_time = self.request.data.get('departure_time')
        # if departure_time:
        #     parsed_time = parse_datetime(departure_time)
        #     if parsed_time:
        #         serializer.validated_data['departure_time'] = parsed_time
        #     else:
        #         raise serializers.ValidationError("Invalid departure time format")
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

    # def perform_update(self, serializer):
    #     print(f"Incoming data: {self.request.data}")  # Prints to terminal

    #     # Ensure only the driver can update their ride
    #     if serializer.instance.driver != self.request.user:
    #         raise PermissionDenied("You can only update your own rides.")
    #     updated_ride = serializer.save()
    #     # Notify passengers of the update
    #     accepted_requests = RideRequest.objects.filter(ride=updated_ride, status="accepted")
    #     for req in accepted_requests:
    #         message = f"The ride from {updated_ride.origin['label']} to {updated_ride.destination['label']} has been updated by the driver. New departure time: {updated_ride.departure_time}. Please review and cancel if it no longer suits you."
    #         notify_user(req.passenger, message)
    #     return updated_ride
    
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
class RideHistoryView(ListAPIView):
    """official for ride history"""
    serializer_class = RideHistorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        user_requests = RideRequest.objects.filter(passenger=user).values_list('ride_id', flat=True)
        return CarpoolRide.objects.filter(
            Q(driver=user) | Q(carpoolride_id__in=user_requests),
            status='completed'
        ).distinct().order_by('-departure_time')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context



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
        
from rest_framework.viewsets import ModelViewSet
# allow users to filter by is_women_only
"""to be deleted, better version above it"""
# class CarpoolRideViewSet(ModelViewSet):
#     """for passengers to view/filter rides, especially females"""
#     queryset = CarpoolRide.objects.all()
#     serializer_class = CarpoolRideSerializer

#     def get_queryset(self):
#         queryset = super().get_queryset()
#         is_women_only = self.request.query_params.get("is_women_only", None)

#         # If filtering by women-only rides
#         if is_women_only == "true":
#             queryset = queryset.filter(is_women_only=True)

#         return queryset


            #kyc upload view
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

# smartdlupload
class UploadSmartDLView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        smart_dl = request.FILES.get("smart_dl")

        if smart_dl:
            user.save_license_copy(smart_dl)

        return Response({"message": "Smart DL uploaded successfully"}, status=200)


# class KYCUploadView(APIView):
#     permission_classes = [IsAuthenticated]
#     parser_classes = (MultiPartParser, FormParser)

#     def post(self, request):
#         user = request.user
#         if not user.is_driver:
#             return Response({"error": "Access denied. Not a driver."}, status=403)

#         file = request.FILES.get("id_verification")
#         if not file:
#             return Response({"error": "No file uploaded."}, status=400)

#         user.id_verification = file
#         user.save()
#         return Response({"message": "KYC document uploaded successfully. Pending approval."})
        #wallet balance and payout request
from django.db import transaction
"""to be deleted"""
class WalletBalanceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if not user.is_driver:
            return Response({"error": "Access denied. Not a driver."}, status=403)

        return Response({"wallet_balance": user.wallet_balance})
    
"""to be deleted..........."""
class PayoutRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        amount = request.data.get("amount")

        if not user.is_driver:
            return Response({"error": "Access denied. Not a driver."}, status=403)

        if amount is None or float(amount) <= 0:
            return Response({"error": "Invalid payout amount."}, status=400)

        if user.wallet_balance < float(amount):
            return Response({"error": "Insufficient balance."}, status=400)

        with transaction.atomic():
            user.wallet_balance -= float(amount)
            user.save()

        return Response({"message": "Payout request successful. Processing..."})
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

        print(f"Received optimize route data: {request.data}")
        print(f"Current location: {current_location}")

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
            print(f"Accepted requests: {list(accepted_requests.values('pickup_location'))}")

            # Validate coordinates
            lat_lng_pattern = re.compile(r'^-?\d+\.\d+,-?\d+\.\d+$')
            try:
                origin = f"{current_location['latitude']},{current_location['longitude']}"
                print(f"Origin: {origin}")
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
                print(f"Destination: {destination}")
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
                print(f"Pickup location for request {req.ridrequest_id}: {pickup}")
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
            print(f"Waypoints: {waypoints_str}")

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
            print(f"Directions API response: {data}")

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

User = get_user_model()

class SendNotificationView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        user_id = request.data.get("user_id")
        message = request.data.get("message")
        carpoolride_id = request.data.get("carpoolride_id")

        if not user_id or not message:
            return Response({"error": "user_id and message are required"}, status=400)

        group_name = f"user_{user_id}"
        channel_layer = get_channel_layer()

        # Try WebSocket push
        try:
            async_to_sync(channel_layer.group_send)(
                group_name,
                {
                    "type": "send_notification",
                    "message": message,
                    "carpoolride_id": carpoolride_id,
                }
            )
            websocket_sent = True
        except Exception as e:
            print(f"WebSocket send error for user {user_id}: {e}")
            websocket_sent = False

        # Fallback to Firebase
        try:
            user = User.objects.get(id=user_id)
            fcm_token = getattr(user, "fcm_token", None)  # adjust field name if needed
            if fcm_token:
                send_push_notification(
                    token=fcm_token,
                    title="Ride Notification",
                    body=message
                )
        except User.DoesNotExist:
            print(f"User {user_id} not found. Firebase push skipped.")
        except Exception as e:
            print(f"Error sending Firebase notification: {e}")

        return Response({
            "status": "Notification sent via WebSocket" if websocket_sent else "Firebase fallback used"
        }, status=200)



# class OptimizeRouteView(APIView):
#     permission_classes = [IsAuthenticated]

#     def post(self, request):
#         current_location = request.data.get('currentLocation')
#         ride_id = request.data.get('ride_id')
#         print(f"received optimize route date:{request.data}")
#         # print(f"Received optimize route data:{request.data})

#         if not current_location or not ride_id:
#             return Response({'error': 'Current location and ride ID are required'}, status=status.HTTP_400_BAD_REQUEST)

#         try:
#             # Validate ride and driver
#             ride = CarpoolRide.objects.get(carpoolride_id=ride_id, driver=request.user)
#             if ride.status != 'in_progress':
#                 return Response({'error': 'Ride must be in progress'}, status=status.HTTP_400_BAD_REQUEST)

#             # Check passenger limit based on vehicle capacity
#             # vehicle = ride.vehicle
#             # if not vehicle:
#             #     return Response({'error': 'No vehicle assigned to ride'}, status=status.HTTP_400_BAD_REQUEST)
#             accepted_requests = RideRequest.objects.filter(ride=ride, status='accepted')
#             print(f"Accepted requests pickup values: {list(accepted_requests.values('pickup_location'))}")
#             # if len(accepted_requests) > vehicle.capacity:
#             #     return Response({'error': f'Maximum of {vehicle.capacity} passengers allowed'}, status=status.HTTP_400_BAD_REQUEST)

#             # Validate coordinates
#             lat_lng_pattern = re.compile(r'^-?\d+\.\d+,-?\d+\.\d+$')
#             origin = f"{current_location['latitude']},{current_location['longitude']}"
#             print(f"Origin: {origin}")
#             if not lat_lng_pattern.match(origin):
#                 return Response({'error': 'Invalid current location format'}, status=status.HTTP_400_BAD_REQUEST)

#             destination = f"{ride.destination['lat']},{ride.destination['lng']}"
#             print(f"Destination=: {destination}")
#             if not lat_lng_pattern.match(destination):
#                 return Response({'error': 'Invalid destination format'}, status=status.HTTP_400_BAD_REQUEST)

#             # Get passenger pickup locations
#             waypoints = []
#             for req in accepted_requests:
#                 pickup = req.pickup_location
#                 logger.debug(f"Pickup location for request {req.ridrequest_id}: {pickup}")
#                 if not isinstance(pickup, dict):
#                     return Response(
#                         {'error': f"Invalid pickup location format for request {req.ridrequest_id} (must be a JSON object)"},
#                         status=status.HTTP_400_BAD_REQUEST
#                     )
#                 if not all(key in pickup for key in ['lat', 'lng']):
#                     return Response(
#                         {'error': f"Pickup location missing lat/lng for request {req.ridrequest_id}"},
#                         status=status.HTTP_400_BAD_REQUEST
#                     )
#                 waypoint = f"{pickup['lat']},{pickup['lng']}"
#                 if not lat_lng_pattern.match(waypoint):
#                     return Response(
#                         {'error': f"Invalid waypoint coordinates for request {req.ridrequest_id}"},
#                         status=status.HTTP_400_BAD_REQUEST
#                     )
#                 waypoints.append(waypoint)
#             waypoints_str = '|'.join(waypoints) if waypoints else ''
#             # logger.debug(f"Waypoints: {waypoints_str}")
#             print(f"Waypoints: {waypoints_str}")
#             # waypoints = '|'.join(
#             #     [f"{req.pickup_location['lat']},{req.pickup_location['lng']}" for req in accepted_requests]
#             # )
#             # for waypoint in waypoints.split('|'):
#             #     if waypoint and not lat_lng_pattern.match(waypoint):
#             #         return Response({'error': 'Invalid waypoint format'}, status=status.HTTP_400_BAD_REQUEST)

#             # Update driver's location
#             UserLocation.objects.update_or_create(
#                 user=request.user,
#                 ride=ride,
#                 defaults={'latitude': current_location['latitude'], 'longitude': current_location['longitude']}
#             )

#             # Google Maps Directions API request
#             url = 'https://maps.googleapis.com/maps/api/directions/json'
#             params = {
#                 'origin': origin,
#                 'destination': destination,
#                 'waypoints': f'optimize:true|{waypoints}' if waypoints else '',
#                 'key': settings.GOOGLE_MAPS_API_KEY,
#             }
#             # Log the full API URL
#             api_url = f"{url}?{urlencode(params)}"
#             print(f"Directions API request URL: {api_url}")
#             print(f"Directions API request params: {params}")
#             response = requests.get(url, params=params)
#             response.raise_for_status()
#             data = response.json()
#             print(f"Directions API response: {data}")
            
#             if data.get('status') == 'NOT_FOUND':
#                 return Response(
#                     {'error': 'No route found. Check origin, waypoints, or destination coordinates.'},
#                     status=status.HTTP_400_BAD_REQUEST)

#             if data.get('status') != 'OK':
#                 return Response({'error': f"Directions API error: {data.get('status')}"}, status=status.HTTP_400_BAD_REQUEST)

#             # Include passenger data
#             passenger_data = [
#                 {
#                     'user_id': req.passenger.id,
#                     'pickup_lat': req.pickup_location['lat'],
#                     'pickup_lng': req.pickup_location['lng'],
#                     'label': req.pickup_location['label'],
#                     'name': req.passenger.fullname,
#                 }
#                 for req in accepted_requests
#             ]

#             return Response({
#                 'status': data.get('status'),
#                 'optimized_order': data.get('routes', [{}])[0].get('waypoint_order', []),
#                 'route': data.get('routes', [{}])[0],
#                 'passengers': passenger_data,
#                 'ride_id': str(ride.carpoolride_id),
#             })
#         except CarpoolRide.DoesNotExist:
#             return Response({'error': 'Ride not found or not authorized'}, status=status.HTTP_404_NOT_FOUND)
#         except requests.RequestException as e:
#             return Response({'error': f'Failed to optimize route: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
#         except KeyError as e:
#             return Response({'error': f'Missing required field: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)




# class OptimizeRouteView(APIView):
#     """FOR THE DRIVERS VIEWS TO OPTIMIZE ROUTES"""
#     permission_classes = [IsAuthenticated]

#     def post(self, request):
#         current_location = request.data.get("currentLocation")
#         # print(f"this is the current location: {current_location}")
#         rides = request.data.get("rides")
        
#         # print(f"this is the request data in optimizedroutview: {request.data}")

#         # if not current_location or not rides:
#         # if not rides:
#         # if not current_location:
#         if not current_location or not rides:
#             return Response({"error": "Current location and rides data are required."}, status=400)
#         try:
#             # Prepare data for Google Maps Route Optimization API
#             api_key = settings.GOOGLE_MAPS_API_KEY  # Store in settings.py
#             url = "https://maps.googleapis.com/maps/api/directions/json"

#             origin = f"{current_location['latitude']},{current_location['longitude']}"
#             destination = f"{rides[0]['destination']['lat']},{rides[0]['destination']['lng']}"

#             waypoints = "|".join(
#                     [f"{ride['origin']['lat']},{ride['origin']['lng']}" for ride in rides]
#                 )
#             params = {
#                     "origin": origin,
#                     "destination": destination,
#                     "waypoints": f"optimize:true|{waypoints}",
#                     "key": api_key
#                 }
#             response = requests.get(url, params=params)
#             response.raise_for_status()
#             data = response.json()
#             return Response({
#                     "status": data.get("status"),
#                     "optimized_order": data.get("routes", [{}])[0].get("waypoint_order", []),
#                     "route": data.get("routes", [{}])[0]
#                 })
#         except requests.RequestException as e:
#             return Response({"error": f"Failed to optimize route: {str(e)}"}, status=500)
            
from django.http import HttpResponse
import requests

def google_maps_tile(request, z, x, y):
    api_key = settings.GOOGLE_MAPS_API_KEY  # Securely stored in settings.py
    url = f"https://www.google.com/maps/vt?lyrs=m@189&x={x}&y={y}&z={z}&key={api_key}"
    response = requests.get(url)
    return HttpResponse(response.content, content_type="image/png")

        # try:
        #     response = requests.post(
        #         url,
        #         headers={"Content-Type": "application/json"},
        #         json=request_body,
        #         params={"key": api_key}
        #     )
        #     response.raise_for_status()
        #     data = response.json()
        #     return Response({"route": data.get("routes", [{}])[0]})
        # except requests.RequestException as e:
        #     return Response({"error": f"Failed to optimize route: {str(e)}"}, status=500)

from .serializers import RideRequestSerializer, CarpoolRideSerializer
from rest_framework.generics import UpdateAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import serializers
from .models import RideRequest, CarpoolRide
# from .serializers import RideRequestSerializer
from Taxi.utils import notify_user  # Import notification system
"""to be deleted no ride requests are made by passengers"""
class ApproveRideRequestView(UpdateAPIView):
    """to be deleted no ride requests are made by passengers"""
    serializer_class = RideRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Retrieve pending ride requests for the authenticated driver."""
        return RideRequest.objects.filter(ride__driver=self.request.user, status="pending")

    def perform_update(self, serializer):
        ride_request = self.get_object()
        ride = ride_request.ride

        # Ensure the ride is not full
        if ride.available_seats > 0:
            serializer.save(status="accepted")
            ride.available_seats -= 1
            ride.save()

            # Notify the passenger that their ride request was accepted
            message = f"Your ride request for {ride.pickup_location} has been accepted!"
            notify_user(ride_request.passenger, message)

            # If no more seats are available, mark ride as full
            if ride.available_seats == 0:
                ride.is_full = True
                ride.save()

            return Response({"message": "Ride request accepted and passenger notified."})
        
        else:
            raise serializers.ValidationError("No seats available.")

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
        
        # Ensure only the ride's driver can accept requests
        if ride_request.ride.driver != request.user:
            return Response({"error": "Only the ride driver can accept requests."}, status=status.HTTP_403_FORBIDDEN)

        # Ensure there are enough seats available before accepting
        if ride_request.seats_requested > ride_request.ride.available_seats:
            return Response(
                {"error": f"Not enough available seats. Only {ride_request.ride.available_seats} left."},
                status=status.HTTP_400_BAD_REQUEST
            )
        passenger_wallet = UserWallet.objects.get(user=ride_request.passenger)
        fare = ride_request.ride.fare

        if passenger_wallet.balance < fare:
            return Response({"error": "Passenger has insufficient balance."},
                            status=status.HTTP_400_BAD_REQUEST)

        # Deduct and hold in escrow
        passenger_wallet.balance -= fare
        passenger_wallet.save()

        WalletTransaction.objects.create(
            user=ride_request.passenger,
            amount=fare,
            transaction_type="ride_payment",
            status="escrow_hold",
            reference=f"RID-{get_random_string(8)}"
        )
        # Mark the request as accepted
        ride_request.status = "accepted"
        ride_request.save()
        
        # # Notify the passenger that their ride request was accepted
        # message = f"Your ride request for {ride.pickup_location} has been accepted!"
        # notify_user(ride_request.passenger, message)

        # Reduce available seats
        ride_request.ride.available_seats -= ride_request.seats_requested
        ride_request.ride.save()

        return Response({"message": "Ride request accepted successfully."}, status=status.HTTP_200_OK)





# drivers to reject ride if they want to do so:
"""to be deleted no ride requests are made by passengers"""
class RejectRideRequestView(UpdateAPIView):
    """View for a driver to decline a ride request."""
    queryset = RideRequest.objects.all()
    permission_classes = [IsAuthenticated]

    def update(self, request, *args, **kwargs):
        ride_request = self.get_object()

        # Ensure only the driver of the ride can reject requests
        if ride_request.ride.driver != request.user:
            return Response({"error": "Only the ride driver can reject requests."}, status=status.HTTP_403_FORBIDDEN)

        # Prevent modifying a request that was already accepted or declined
        if ride_request.status in ["accepted", "declined"]:
            return Response({"error": "This request has already been processed."}, status=status.HTTP_400_BAD_REQUEST)

        # Mark the request as declined
        ride_request.status = "declined"
        ride_request.save()
        
        #  # Notify the passenger
        # message = f"Your ride request for {ride_request.ride.pickup_location} has been declined!"
        # notify_user(ride_request.passenger, message)


        return Response({"message": "Ride request declined."}, status=status.HTTP_200_OK)

"""this is the main to allow drivers to decline passengers to join their carpool"""
from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import RideRequest

class DeclineRideRequestView(generics.UpdateAPIView):
    """View for a driver to decline a ride request.
    --Ensures only the ride's driver can reject a request.
    --Prevents modifying a request that was already accepted or declined.
    --Updates the request status to "declined".
    """
    queryset = RideRequest.objects.all()
    permission_classes = [IsAuthenticated]

    def update(self, request, *args, **kwargs):
        ride_request = self.get_object()

        # Ensure only the driver of the ride can reject requests
        if ride_request.ride.driver != request.user:
            return Response({"error": "Only the ride driver can reject requests."}, status=status.HTTP_403_FORBIDDEN)

        # Prevent modifying a request that was already accepted or declined
        if ride_request.status in ["accepted", "declined"]:
            return Response({"error": "This request has already been processed."}, status=status.HTTP_400_BAD_REQUEST)

        # Mark the request as declined
        ride_request.status = "declined"
        ride_request.save()
        
        #   # Notify the passenger
        # message = f"Your ride request for {ride_request.ride.pickup_location} has been declined!"
        # notify_user(ride_request.passenger, message)

        return Response({"message": "Ride request declined."}, status=status.HTTP_200_OK)


# accept/reject ride requests
# from .models import RideRequest

# class AcceptRideView(APIView):
#     permission_classes = [IsAuthenticated]

#     def post(self, request, ride_id):
#         user = request.user
#         if not user.is_driver:
#             return Response({"error": "Access denied. Not a driver."}, status=403)

#         try:
#             ride = RideRequest.objects.get(id=ride_id, status="pending")
#         except RideRequest.DoesNotExist:
#             return Response({"error": "Ride request not found or already taken."}, status=404)

#         ride.driver = user
#         ride.status = "accepted"
#         ride.save()

#         return Response({"message": "Ride accepted successfully."})


# class RejectRideView(APIView):
#     permission_classes = [IsAuthenticated]

#     def post(self, request, ride_id):
#         user = request.user
#         if not user.is_driver:
#             return Response({"error": "Access denied. Not a driver."}, status=403)

#         try:
#             ride = RideRequest.objects.get(id=ride_id, status="pending")
#         except RideRequest.DoesNotExist:
#             return Response({"error": "Ride request not found or already taken."}, status=404)

#         ride.status = "rejected"
#         ride.save()

#         return Response({"message": "Ride rejected successfully."})


        
# driver to update their location
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import DriverLocation

from geopy.distance import geodesic
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from .models import UserLocation, RideRequest, CarpoolRide
from .utils import notify_user


class UpdateDriverLocationView(APIView):
    permission_classes = [IsAuthenticated]

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
                    print(f"Sent notification to passenger {ride_request.passenger.id} for ride {ride_id}")

        return Response({
            "message": "Driver location updated successfully.",
            "is_simulated": is_simulated
        })
# class UpdateDriverLocationView(APIView):
#     permission_classes = [IsAuthenticated]

#     def post(self, request):
#         user = request.user
#         latitude = request.data.get("latitude")
#         longitude = request.data.get("longitude")
#         ride_id = request.data.get("ride_id")

#         print(f"Received location update request: user={user.id}, ride_id={ride_id}, lat={latitude}, lng={longitude}")

#         if not latitude or not longitude or not ride_id:
#             print("Missing required fields")
#             return Response({"error": "Latitude, longitude, and ride_id are required."}, status=400)

#         try:
#             ride = CarpoolRide.objects.get(
#                 carpoolride_id=ride_id,
#                 driver=user,
#                 status="in_progress"
#             )
#         except CarpoolRide.DoesNotExist:
#             print(f"No active ride found for user={user.id}, ride_id={ride_id}")
#             return Response({"error": "You are not assigned to an active ride with this ID."}, status=403)

#         # Update or create location
#         try:
#             location, created = UserLocation.objects.update_or_create(
#                 user=user,
#                 ride=ride,
#                 defaults={"latitude": latitude, "longitude": longitude}
#             )
#             action = "created" if created else "updated"
#             print(f"UserLocation {action}: user={user.id}, ride_id={ride_id}, lat={latitude}, lng={longitude}, updated_at={location.updated_at}")
#         except Exception as e:
#             print(f"Error updating UserLocation: user={user.id}, ride_id={ride_id}, error={str(e)}")
#             return Response({"error": "Failed to update location."}, status=500)

#         # Notify passengers if driver is near
#         for ride_request in RideRequest.objects.filter(ride=ride, status="accepted"):
#             pickup_coords = (ride_request.pickup_location["lat"], ride_request.pickup_location["lng"])
#             driver_coords = (float(latitude), float(longitude))
#             distance = geodesic(driver_coords, pickup_coords).km
#             print(f"Distance to passenger {ride_request.passenger.id}: {distance} km")
#             if distance < 0.5:
#                 message = f"Your ride is approaching! Get ready for pickup at {ride_request.pickup_location['label']}."
#                 notify_user(ride_request.passenger, message)
#                 print(f"Sent notification to passenger {ride_request.passenger.id} for ride {ride_id}")

#         return Response({"message": "Driver location updated successfully."})
# class UpdateDriverLocationView(APIView):
#     permission_classes = [IsAuthenticated]

#     def post(self, request):
#         user = request.user
#         latitude = request.data.get("latitude")
#         longitude = request.data.get("longitude")
#         ride_id = request.data.get("ride_id")  # Optional, for linking to ride

#         if not latitude or not longitude or not ride_id:
#             return Response({"error": "Latitude and Longitude and ride_id are required."}, status=400)

#         # Ensure the driver is part of an active ride
#         active_rides = CarpoolRide.objects.filter(driver=user, is_completed=False)
#         if not active_rides.exists():
#             return Response({"error": "You are not assigned to an active ride."}, status=403)

#         # Update or create location
#         location, created = UserLocation.objects.update_or_create(
#             driver=user, defaults={
#                 "latitude": latitude, 
#                 "longitude": longitude,
#                 "ride": active_rides }
#         )

#         # Notify passengers if the driver is near their pickup point
#         for ride in active_rides:
#             for ride_request in RideRequest.objects.filter(ride=ride, status="accepted"):
#                 pickup_coords = (ride_request.ride.pickup_lat, ride_request.ride.pickup_lng)
#                 driver_coords = (float(latitude), float(longitude))

#                 distance = geodesic(driver_coords, pickup_coords).km
#                 if distance < 0.5:  # Notify if driver is within 500 meters
#                     message = f"Your ride is approaching! Get ready for pickup at {ride_request.ride.pickup_location}."
#                     notify_user(ride_request.passenger, message)

#         return Response({"message": "Driver location updated successfully."})

#passengers view to see drivers location
from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import DriverLocation, RideRequest, CarpoolRide

# class GetDriverLocationView(RetrieveAPIView):
#     permission_classes = [IsAuthenticated]

#     def get(self, request, ride_id):
#         """Fetch the driver's latest location for a specific ride, only for accepted passengers."""
#         user = request.user

#         # Check if the ride exists
#         try:
#             ride = CarpoolRide.objects.get(id=ride_id)
#         except CarpoolRide.DoesNotExist:
#             return Response({"error": "Ride not found."}, status=404)

#         # Ensure the user has an accepted request for this ride
#         is_accepted_passenger = RideRequest.objects.filter(
#             ride=ride, passenger=user, status="accepted"
#         ).exists()

#         if not is_accepted_passenger:
#             return Response({"error": "You are not authorized to view this location."}, status=403)

#         # Get the driver's latest location
#         try:
#             location = DriverLocation.objects.get(driver=ride.driver)
#             return Response({
#                 "latitude": location.latitude,
#                 "longitude": location.longitude
#             })
#         except DriverLocation.DoesNotExist:
#             return Response({"error": "Driver location not found."}, status=404)

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

class CompleteRideView(APIView):
    """Driver completes the ride — triggers escrow release and notifications."""
    permission_classes = [IsAuthenticated]

    def patch(self, request, ride_id):
        try:
            ride = CarpoolRide.objects.get(carpoolride_id=ride_id, driver=request.user)
        except CarpoolRide.DoesNotExist:
            return Response({"error": "Ride not found or unauthorized."}, status=404)

        if ride.status != "in_progress":
            return Response({"error": "Only in-progress rides can be completed."}, status=400)

        ride.status = "completed"
        ride.save()

        driver_wallet, _ = UserWallet.objects.get_or_create(user=ride.driver)
        accepted_requests = RideRequest.objects.filter(ride=ride, status="accepted")

        for req in accepted_requests:
            fare = ride.fare
            driver_wallet.balance += fare
            driver_wallet.save()

            WalletTransaction.objects.create(
                user=ride.driver,
                amount=fare,
                transaction_type="escrow_release",
                status="completed",
                reference=f"PAYOUT-{get_random_string(10)}"
            )

            notify_user(
                req.passenger,
                f"Your ride from {req.pickup_location['label']} is complete. Thank you for using our service!",
                carpoolride_id=str(ride.carpoolride_id)
            )

        return Response({"message": "Ride completed and driver paid."}, status=200)


def start_ride(request, ride_id):
    """Mark a ride as started and notify passengers."""
    ride = CarpoolRide.objects.get(id=ride_id)
    
    # Update status
    ride.status = "in_progress"
    ride.save()

    # Notify passengers
    for ride_request in ride.requests.filter(status="accepted"):
        message = f"Your ride from {ride.pickup_location} has started!"
        notify_user(ride_request.passenger, message)

    return Response({"message": "Ride started."})

def complete_ride(request, ride_id):
    """Mark a ride as completed and notify passengers."""
    ride = CarpoolRide.objects.get(id=ride_id)
    
    # Update status
    ride.status = "completed"
    ride.save()

    # Notify passengers
    for ride_request in ride.requests.filter(status="accepted"):
        message = f"Your ride from {ride.pickup_location} is complete. Thank you for using our service!"
        notify_user(ride_request.passenger, message)

    return Response({"message": "Ride completed."})

# #notify passengers on driver's location
# from .utils import send_notification
# from .firebase import send_push_notification
# """If users don't have the app open, we can use Firebase Cloud Messaging (FCM)."""
# def notify_passenger(ride_request):
#     """Notify passengers when driver is near pickup location."""
#     message = f"Your ride is approaching! Get ready for pickup at {ride_request.ride.pickup_location}."
     
#      # WebSocket Notification (for real-time updates)
#     send_notification(ride_request.passenger.id, message)
    
#     # Firebase Push Notification (for background alerts)
#     send_push_notification(ride_request.passenger, message)


# Passengers Search & Join Available Rides  
# Since there are no real-time ride requests, passengers search for trips.
"""to be deleted since carpool ride viewset handles even women-only rides"""
class AvailableRidesView(ListAPIView):
    pass



# ADMIN

from .utils import verify_national_id
from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from .models import CustomUser
# from .serializers import UserKYCSerializer


from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from .models import CustomUser
# from .serializers import UserKYCSerializer
from .utils import verify_national_id  # Import our utility function

"""to be deleted"""
# class VerifyKYCView(generics.UpdateAPIView):
#     """Admin can approve/reject KYC after ID verification via eCitizen."""
#     queryset = CustomUser.objects.all()
#     serializer_class = UserKYCSerializer
#     permission_classes = [IsAdminUser]

#     def update(self, request, *args, **kwargs):
#         user = self.get_object()

#         # Ensure National ID is provided
#         if not user.national_id:
#             return Response({"error": "User has not provided a National ID."}, status=status.HTTP_400_BAD_REQUEST)

#         # Check National ID with eCitizen
#         if not verify_national_id(user.national_id):
#             return Response({"error": "National ID verification failed."}, status=status.HTTP_400_BAD_REQUEST)

#         # Approve KYC if ID is valid
#         user.is_verified = True
#         user.save()

#         return Response({"message": "KYC verification approved."}, status=status.HTTP_200_OK)

from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from .models import CustomUser
# from .serializers import DriverKYCSerializer
from .utils import verify_driving_license  # Import utility function
"""to be deleted verification of ntsa license to be handled differently"""
# class VerifyDriverView(generics.UpdateAPIView):
#     """Admin can approve/reject driver after NTSA license verification."""
#     queryset = CustomUser.objects.all()
#     serializer_class = DriverKYCSerializer
#     # permission_classes = [IsAdminUser]
#     permission_classes = [IsAuthenticated]
    
#     def update(self, request, *args, **kwargs):
#         verification_result = verify_driving_license(request)

#         if verification_result.get("error"):
#             return Response({"error": verification_result["error"]}, status=status.HTTP_400_BAD_REQUEST)

#         if verification_result["status"] == "failed":
#             return Response({"error": "Driving License verification failed. Check logs for details."}, status=status.HTTP_400_BAD_REQUEST)

#         # Approve driver
#         request.user.is_driver = True
#         request.user.is_verified = True
#         request.user.save()

#         return Response({"message": "Driver verification approved."}, status=status.HTTP_200_OK)

    # def update(self, request, *args, **kwargs):
    #     user = self.get_object()

    #     # Ensure Driving License is provided
    #     if not user.driving_license_number:
    #         return Response({"error": "User has not provided a Driving License Number."}, status=status.HTTP_400_BAD_REQUEST)

    #     # Check Driving License with NTSA
    #     if not verify_driving_license(user.driving_license_number):
    #         return Response({"error": "Driving License verification failed."}, status=status.HTTP_400_BAD_REQUEST)

    #     # Approve as a verified driver
    #     user.is_driver = True
    #     user.is_verified = True  # Fully verified
    #     user.save()

    #     return Response({"message": "Driver verification approved."}, status=status.HTTP_200_OK)


# resetting users' cooldown
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from .models import CustomUser

class AdminResetCooldownView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, *args, **kwargs):
        user_id = request.data.get("user_id")
        try:
            user = CustomUser.objects.get(id=user_id)
            user.cooldown_until = None  # Reset cooldown
            user.save()

            return Response({"message": f"User {user.phone_number} cooldown reset."}, status=status.HTTP_200_OK)
        except CustomUser.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)



"""official for submitting a dispute"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import CarpoolRide, WalletTransaction, Dispute

class SubmitDisputeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        ride_id = request.data.get("ride_id")
        transaction_id = request.data.get("transaction_id")
        reason = request.data.get("reason")

        if not reason:
            return Response({"error": "Reason for dispute is required."}, status=400)

        ride = CarpoolRide.objects.filter(id=ride_id).first() if ride_id else None
        transaction = WalletTransaction.objects.filter(id=transaction_id, user=user).first() if transaction_id else None

        if not ride and not transaction:
            return Response({"error": "Must provide a valid ride or transaction."}, status=400)

        dispute = Dispute.objects.create(user=user, ride=ride, transaction=transaction, reason=reason)
        return Response({"message": "Dispute submitted successfully!", "dispute_id": dispute.id}, status=201)





"""Admins can approve a refund, reject a claim, or adjust balances."""
from rest_framework.permissions import IsAdminUser
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAdminUser

class ResolveDisputeView(APIView):
    permission_classes = [IsAdminUser]
    """official despute resolver"""

    def post(self, request, dispute_id):
        try:
            dispute = Dispute.objects.get(id=dispute_id)
        except Dispute.DoesNotExist:
            return Response({"error": "Dispute not found"}, status=404)

        resolution_notes = request.data.get("resolution_notes", "")
        action = request.data.get("action")  # approve, reject, adjust

        if action == "approve" and dispute.transaction:
            with transaction.atomic():
                wallet = UserWallet.objects.get(user=dispute.user)
                wallet.balance += dispute.transaction.amount
                wallet.save()
                dispute.status = "resolved"
                WalletTransaction.objects.create(
                    user=dispute.user,
                    amount=dispute.transaction.amount,
                    transaction_type="dispute_refund",
                    status="completed",
                    reference=f"DISP-{dispute_id}",
                )
        elif action == "reject":
            dispute.status = "rejected"
        elif action == "adjust":
            amount = Decimal(request.data.get("amount", 0))
            if amount > 0:
                with transaction.atomic():
                    wallet = UserWallet.objects.get(user=dispute.user)
                    wallet.balance += amount
                    wallet.save()
                    dispute.status = "resolved"
                    WalletTransaction.objects.create(
                        user=dispute.user,
                        amount=amount,
                        transaction_type="dispute_adjustment",
                        status="completed",
                        reference=f"ADJ-{dispute_id}",
                    )
            else:
                return Response({"error": "Invalid adjustment amount"}, status=400)
        else:
            return Response({"error": "Invalid action"}, status=400)

        dispute.resolution_notes = resolution_notes
        dispute.save()
        return Response({"message": "Dispute resolved successfully!"})

class ResolveDisputeView(APIView):
    """to be deleted"""
    permission_classes = [IsAdminUser]

    def post(self, request, dispute_id):
        dispute = Dispute.objects.get(id=dispute_id)
        resolution_notes = request.data.get("resolution_notes")
        action = request.data.get("action")  # Approve, Reject, Adjust

        if action == "approve":
            # Refund user if valid
            if dispute.transaction:
                wallet = dispute.transaction.user.wallet
                wallet.balance += dispute.transaction.amount  # Refund money
                wallet.save()

            dispute.status = "resolved"
        elif action == "reject":
            dispute.status = "rejected"
        elif action == "adjust":
            # Admin can manually adjust balances here if needed
            pass
        else:
            return Response({"error": "Invalid action."}, status=400)

        dispute.resolution_notes = resolution_notes
        dispute.save()

        return Response({"message": "Dispute resolved successfully!"})

# class AllDisputesView(APIView):

    """official""" 
    class AllDisputesView(APIView):
        permission_classes = [IsAdminUser]
        pagination_class = PageNumberPagination

        def get(self, request):
            disputes = Dispute.objects.all().select_related("user", "ride", "transaction")
            paginator = self.pagination_class()
            page = paginator.paginate_queryset(disputes, request)
            serializer = DisputeSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)
    # permission_classes = [IsAdminUser]

    # def get(self, request):
    #     disputes = Dispute.objects.all().select_related("user", "ride", "transaction")
    #     serializer = DisputeSerializer(disputes, many=True)
    #     return Response(serializer.data)

class AllDisputesView(APIView):
    """admin to view all disputes"""
    permission_classes = [IsAdminUser]  # Restrict to admins
    def get(self, request):
        disputes = Dispute.objects.all()
        serializer = DisputeSerializer(disputes, many=True)
        return Response(serializer.data)





# passenger dashboard
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import RideRequest, CarpoolRide, DriverLocation

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
# class PassengerDriverLocationView(APIView):
#     """Allow passengers to fetch the driver's live location for a ride they are part of."""
#     permission_classes = [IsAuthenticated]

#     def get(self, request, ride_id):
#         try:
#             # Check if the user has an accepted ride request for this ride
#             ride_request = RideRequest.objects.filter(
#                 ride__carpoolride_id=ride_id,
#                 passenger=request.user,
#                 status="accepted"
#             ).first()

#             if not ride_request:
#                 return Response(
#                     {"error": "You are not authorized to view this driver's location"},
#                     status=403
#                 )

#             # Fetch the latest driver location
#             location = UserLocation.objects.filter(user=ride_request.ride.driver).order_by('-updated_at').first()
#             if not location:
#                 return Response(
#                     {"error": "Driver location not found"},
#                     status=404
#                 )
#             print({
#                     "user_id": str(ride_request.ride.driver.id),
#                     "latitude": location.latitude,
#                     "longitude": location.longitude,
#                     "name": ride_request.ride.driver.fullname,
#                     "updated_at": location.updated_at,
#                 })
#             return Response({
#                 "user_id": str(ride_request.ride.driver.id),
#                 "latitude": location.latitude,
#                 "longitude": location.longitude,
#                 "name": ride_request.ride.driver.fullname,
#                 "updated_at": location.updated_at,
#             })

#         except CarpoolRide.DoesNotExist:
#             return Response(
#                 {"error": "Ride not found"},
#                 status=404
#             )
#         except Exception as e:
#             logger.error(f"Error fetching driver location for passenger: {str(e)}")
#             return Response(
#                 {"error": f"Internal server error: {str(e)}"},
#                 status=500
#             )
#Passengers Request to Join a Ride (Pending Approval)
# Instead of automatically joining a ride, passengers send a request, and the driver approves or declines.
from django.shortcuts import get_object_or_404
class RequestToJoinRideView(CreateAPIView):
    """passengers could request rides"""
    serializer_class = RideRequestSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        request_data = self.request.data
        print(f"Received request data: {request_data}")  # 🔍 Log incoming data

   
        ride_id = self.request.data.get("ride")  # Expecting ride ID from frontend
        pickup_location = self.request.data.get("pickup_location")
        
        ride = get_object_or_404(CarpoolRide, carpoolride_id=ride_id)  # Ensure ride exists
        passenger_wallet = UserWallet.objects.get(user=self.request.user)
        if passenger_wallet.balance < ride.fare:
            raise ValidationError("Insufficient balance to request this ride.")
        
        serializer.save(
            passenger=self.request.user,
            ride=ride,
            pickup_location=pickup_location,  # Ensure pickup location is saved
            status="pending"
            )



from rest_framework.permissions import AllowAny
from datetime import time
from django.db.models import Q 
"""allow passengers to search for different rides"""
class PassengerCarpoolRideViewSet(ModelViewSet):
    queryset = CarpoolRide.objects.all()
    serializer_class = CarpoolRideSerializer
    # permission_classes = [IsAuthenticated]  # Optional: require login
    permission_classes = [AllowAny]  # Optional: require login

    def get_queryset(self):
        queryset = super().get_queryset()
        # Filter for available rides only ("pending" means not completed and not canceled)
        queryset = queryset.filter(is_completed=False, is_cancelled=False, available_seats__gt=0)
        print(f"this is the request params: {self.request.query_params}")
         # Filter by pickup location**
        origin = self.request.query_params.get("origin", None)
        print(f"this is the origin: {origin}")
        if origin:
            queryset = queryset.filter(Q(origin__icontains=origin))
        
        # Filter by is_women_only if provided in query params
        is_women_only = self.request.query_params.get("is_women_only", None)
        if is_women_only == "true":
            queryset = queryset.filter(is_women_only=True)
        elif is_women_only == "false":
            queryset = queryset.filter(is_women_only=False)
        # If is_women_only is not specified, return all available rides (no filter)

        # Exclude rides where the passenger is the driver
        queryset = queryset.exclude(driver=self.request.user)
        
        # Get pickup date filter
        pickup_date = self.request.query_params.get("pickup_date", None)
        if pickup_date:
            queryset = queryset.filter(departure_time__date=pickup_date)

        # Get selected time slot
        time_slot = self.request.query_params.get("time_slot", None)
        if time_slot:
            if time_slot == "before_06":
                queryset = queryset.filter(departure_time__time__lt=time(6, 0))
            elif time_slot == "06_12":
                queryset = queryset.filter(departure_time__time__gte=time(6, 0), departure_time__time__lte=time(12, 0))
            elif time_slot == "12_18":
                queryset = queryset.filter(departure_time__time__gte=time(12, 1), departure_time__time__lte=time(18, 0))
            elif time_slot == "after_18":
                queryset = queryset.filter(departure_time__time__gt=time(18, 0))

        return queryset


class CancelRideView(APIView):
    """Allow a user to cancel a ride before departure."""
    permission_classes = [IsAuthenticated]

    def post(self, request, ride_id):
        user = request.user

        try:
            ride_request = RideRequest.objects.get(ride_id=ride_id, passenger=user, status="accepted")
        except RideRequest.DoesNotExist:
            return Response({"error": "Ride not found or cannot be canceled."}, status=400)

        ride_request.status = "canceled"
        ride_request.save()

        return Response({"message": "Ride canceled successfully."})
    
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
# class DriverLocationView(APIView):
#     """official get driver location"""
#     permission_classes = [IsAuthenticated]

#     def get(self, request, ride_id):
#         try:
#             ride = CarpoolRide.objects.get(carpoolride_id=ride_id, driver=request.user)
#             location = UserLocation.objects.filter(ride=ride, user=request.user).first()
#             if not location:
#                 return Response({'error': 'Driver location not found'}, status=status.HTTP_404_NOT_FOUND)
#             return Response({
#                 'user_id': str(location.user.id),
#                 'latitude': location.latitude,
#                 'longitude': location.longitude,
#                 'name': location.user.fullname,
#                 'updated_at': location.updated_at,
#             })
#         except CarpoolRide.DoesNotExist:
#             return Response({'error': 'Ride not found or not authorized'}, status=status.HTTP_404_NOT_FOUND)

class GetMapKeyView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # print(f"this is the response")
        return Response({"key": settings.GOOGLE_MAPS_API_KEY})

# class GetDriverLiveLocationView(APIView):
#     """Get the live location of the driver for an ongoing ride."""
#     permission_classes = [IsAuthenticated]

#     def get(self, request, ride_id):
#         user = request.user

#         # Check if the user is in an accepted ride
#         try:
#             ride_request = RideRequest.objects.get(ride_id=ride_id, passenger=user, status="accepted")
#         except RideRequest.DoesNotExist:
#             return Response({"error": "You are not in this ride."}, status=403)

#         # Fetch driver's latest location
#         try:
#             location = DriverLocation.objects.get(driver=ride_request.ride.driver)
#             return Response({
#                 "latitude": location.latitude,
#                 "longitude": location.longitude
#             })
#         except DriverLocation.DoesNotExist:
#             return Response({"error": "Driver location not available."}, status=404)

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

# deposit funds to wallet
""" Official deposit funds to wallet
Passengers deposit funds into their wallet balance before booking a ride."""
"""to be used in prod"""
# class DepositToWalletView(APIView):
#     def post(self, request):
#         user = request.user
#         phone_number = request.data.get("phone_number")
#         amount = request.data.get("amount")
        
#         if not phone_number or not amount or Decimal(amount) <= 0:
#             return Response({"error": "Invalid phone number or amount"}, status=400)

#         # Create or get wallet
#         wallet, _ = UserWallet.objects.get_or_create(user=user)
        
#         # Initiate STK Push
#         access_token = get_mpesa_access_token()
#         headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
#         payload = {
#             "BusinessShortCode": settings.MPESA_SHORTCODE,
#             "Password": generate_stk_password(),
#             "Timestamp": generate_timestamp(),
#             "TransactionType": "CustomerPayBillOnline",
#             "Amount": str(Decimal(amount)),  # Ensure string for M-Pesa
#             "PartyA": phone_number,
#             "PartyB": settings.MPESA_SHORTCODE,
#             "PhoneNumber": phone_number,
#             "CallBackURL": settings.MPESA_CALLBACK_URL,
#             "AccountReference": f"Wallet-{user.id}",
#             "TransactionDesc": "Wallet top-up",
#         }

#         response = requests.post(settings.MPESA_STK_PUSH_URL, json=payload, headers=headers)
#         response_data = response.json()
        
#         if response.status_code == 200 and response_data.get("ResponseCode") == "0":
#             # Store wallet deposit as pending
#             WalletTransaction.objects.create(
#                 user=user, amount=amount, transaction_type="deposit", status="pending",
#                 reference=response_data.get("CheckoutRequestID"),
#             )
#             return Response({"message": "Wallet top-up initiated. Approve the STK Push."})
#         return Response({"error": "Failed to initiate wallet deposit.", "here are the details": response_data}, status=400)

"""to be used in prod"""
# class MpesaCallbackView(APIView):
#     """ official to handle mpesa confirmation"""
#     def post(self, request):
#         data = request.data.get("Body", {}).get("stkCallback", {})
#         checkout_request_id = data.get("CheckoutRequestID")
#         result_code = data.get("ResultCode")

#         if result_code == 0:  # Success
#             transaction = WalletTransaction.objects.get(reference=checkout_request_id, status="pending")
#             transaction.status = "completed"
#             transaction.save()
#             wallet = UserWallet.objects.get(user=transaction.user)
#             wallet.balance += transaction.amount
#             wallet.save()
#         else:  # Failed
#             transaction = WalletTransaction.objects.get(reference=checkout_request_id, status="pending")
#             transaction.status = "failed"
#             transaction.save()

#         return Response({"message": "Callback processed"})
    
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
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from decimal import Decimal
from .models import UserWallet, WalletTransaction
from .utils import get_mpesa_access_token
"""to be used in"""
# class WithdrawToMpesaView(APIView):
#     """official driver withdrawal to mpesa"""
#     permission_classes = [IsAuthenticated]

#     def post(self, request):
#         user = request.user
#         amount = Decimal(request.data.get("amount", 0))

#         if amount <= 0:
#             return Response({"error": "Invalid amount"}, status=400)

#         wallet = UserWallet.objects.select_for_update().get(user=user)
#         if wallet.balance < amount:
#             return Response({"error": "Insufficient wallet balance"}, status=400)

#         # Initiate B2C Withdrawal
#         access_token = get_mpesa_access_token()
#         headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
#         payload = {
#             "InitiatorName": settings.MPESA_INITIATOR,
#             "SecurityCredential": settings.MPESA_SECURITY_CREDENTIAL,
#             "CommandID": "BusinessPayment",
#             "Amount": str(amount),
#             "PartyA": settings.MPESA_SHORTCODE,
#             "PartyB": user.phone_number,
#             "Remarks": "Driver withdrawal",
#             "QueueTimeOutURL": settings.MPESA_B2C_TIMEOUT_URL,
#             "ResultURL": settings.MPESA_B2C_RESULT_URL,
#             "Occasion": f"Withdrawal-{user.id}",
#         }

#         response = requests.post(settings.MPESA_B2C_URL, json=payload, headers=headers)
#         response_data = response.json()

#         if response.status_code == 200 and response_data.get("ResponseCode") == "0":
#             with transaction.atomic():
#                 wallet.balance -= amount
#                 wallet.save()
#                 WalletTransaction.objects.create(
#                     user=user,
#                     amount=amount,
#                     transaction_type="withdrawal",
#                     status="completed",
#                     reference=response_data.get("TransactionID"),
#                 )
#             return Response({"message": "Withdrawal request sent to M-Pesa."})
#         return Response({"error": "Failed to process withdrawal.", "details": response_data}, status=400)
##incase of disputes
"""Users can file disputes for transactions or rides."""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Dispute, CarpoolRide, WalletTransaction
from .serializers import DisputeSerializer



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
"""allows users to send funds to another user
    OFFICIAL transfer of funds that are in the app wallet
"""
class TransferFundsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Transfer funds between users securely."""
        # recipient_id = request.data.get("recipient_id")
        phone_number = request.data.get("phone_number") #receipent's phone number
        amount = request.data.get("amount")

        if not phone_number or not amount or Decimal(amount) <= 0:
            return Response({"error": "Invalid request"}, status=status.HTTP_400_BAD_REQUEST)

        sender_wallet = UserWallet.objects.select_for_update().get(user=request.user)
        
        try:
            recipient_wallet = UserWallet.objects.select_for_update().get(user__phone_number=phone_number)
        except UserWallet.DoesNotExist:
            return Response({"error": "Recipient not found"}, status=status.HTTP_404_NOT_FOUND)

        # Transfer Limit Check: Prevent rapid multiple transfers
        time_threshold = now() - timedelta(minutes=5)  # Prevent transfers every 5 min
        recent_transfers = WalletTransaction.objects.filter(
            user=request.user, transaction_type="transfer", created_at__gte=time_threshold
        ).count()
        
        if recent_transfers >= 3:  # Limit: Max 3 transfers in 5 min
            return Response({"error": "Transfer limit reached. Try again later."}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        if sender_wallet.balance < Decimal(amount):
            return Response({"error": "Insufficient balance"}, status=status.HTTP_400_BAD_REQUEST)

        reference = f"TRF-{get_random_string(10)}"

        try:
            with transaction.atomic():  # Ensures rollback on failure
                sender_wallet.balance -= Decimal(amount)
                sender_wallet.save()

                recipient_wallet.balance += Decimal(amount)
                recipient_wallet.save()

                WalletTransaction.objects.create(
                    user=request.user,
                    recipient=recipient_wallet.user,
                    
                    sender_name=request.user.fullname,
                    sender_phone=request.user.phone_number,
                    recipient_name=recipient_wallet.user.fullname,
                    recipient_phone=recipient_wallet.user.phone_number,
                    
                    # phone_number=phone_number,
                    amount=amount,
                    transaction_type="transfer",
                    status="completed",
                    reference=reference
                )

            # **Send Email Notifications**
            subject = "Wallet Transfer Confirmation"
            sender_message = f"You have successfully sent KES {amount} to user {recipient_wallet.user.fullname}. Transaction Ref: {reference}."
            recipient_message = f"You have received KES {amount} from {request.user.fullname}. Transaction Ref: {reference}."
            
            send_mail(subject, sender_message, "no-reply@carpool.com", [request.user.email])
            send_mail(subject, recipient_message, "no-reply@carpool.com", [recipient_wallet.user.email])

            return Response({"message": "Transfer successful", "reference": reference}, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"error": "Transaction failed. Try again later."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
"""This ensures that:
    Money is held in escrow when a ride starts.
    The driver gets paid when the ride is completed.
    Money is refunded if a dispute occurs.
"""
class CompleteRideView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, ride_id):
        """Release escrow funds when ride is marked as completed."""
        from .models import CarpoolRide  # Assuming you have a ride model

        try:
            ride = CarpoolRide.objects.get(id=ride_id, driver=request.user)
        except CarpoolRide.DoesNotExist:
            return Response({"error": "Ride not found or unauthorized"}, status=status.HTTP_404_NOT_FOUND)

        # Ensure ride is marked as completed
        if ride.status != "completed":
            return Response({"error": "Ride is not completed yet"}, status=status.HTTP_400_BAD_REQUEST)

        # Get the wallet of the driver
        driver_wallet, _ = UserWallet.objects.get_or_create(user=ride.driver)

        # Release escrow funds to driver
        total_fare = sum(request.amount for request in ride.ride_requests.filter(status="accepted"))
        if driver_wallet.release_escrow(total_fare):
            # Record transaction
            reference = f"ESC-{get_random_string(10)}"
            WalletTransaction.objects.create(
                user=ride.driver,
                amount=total_fare,
                transaction_type="escrow_release",
                status="completed",
                reference=reference
            )

            return Response({"message": "Escrow funds released to driver", "reference": reference}, status=status.HTTP_200_OK)
        
        return Response({"error": "Escrow release failed"}, status=status.HTTP_400_BAD_REQUEST)



from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils.crypto import get_random_string
from django.db import transaction
from .models import CarpoolRide, UserWallet, WalletTransaction

class DisputeRideView(APIView):
    """official disput ride view"""
    permission_classes = [IsAuthenticated]

    def post(self, request, ride_id):
        """Handle ride disputes and refund passenger if applicable."""
        try:
            ride = CarpoolRide.objects.get(id=ride_id)
        except CarpoolRide.DoesNotExist:
            return Response({"error": "Ride not found"}, status=404)

        # Check if user is a passenger on this ride
        ride_request = ride.requests.filter(passenger=request.user, status="accepted").first()
        if not ride_request:
            return Response({"error": "Unauthorized action"}, status=403)

        user_wallet = UserWallet.objects.get(user=request.user)
        total_fare = ride_request.transaction.amount if ride_request.transaction else ride.fare  # Use transaction or ride fare

        with transaction.atomic():
            if user_wallet.refund_escrow(total_fare):
                reference = f"REF-{get_random_string(10)}"
                WalletTransaction.objects.create(
                    user=request.user,
                    amount=total_fare,
                    transaction_type="escrow_refund",
                    status="completed",
                    reference=reference,
                )
                # Optionally create a dispute record
                Dispute.objects.create(user=request.user, ride=ride, reason="Ride dispute refund")
                return Response({"message": "Escrow funds refunded", "reference": reference})
            return Response({"error": "Refund failed"}, status=400)



class DisputeRideView(APIView):
    """to be deleted"""
    permission_classes = [IsAuthenticated]

    def post(self, request, ride_id):
        """Handle disputes and refund escrow to user."""
        from .models import CarpoolRide  # Importing the ride model

        try:
            ride = CarpoolRide.objects.get(id=ride_id)
        except CarpoolRide.DoesNotExist:
            return Response({"error": "Ride not found"}, status=status.HTTP_404_NOT_FOUND)

        if request.user != ride.passenger:
            return Response({"error": "Unauthorized action"}, status=status.HTTP_403_FORBIDDEN)

        user_wallet, _ = UserWallet.objects.get_or_create(user=ride.passenger)

        # Refund escrow back to user
        total_fare = sum(request.amount for request in ride.ride_requests.filter(status="accepted"))
        if user_wallet.refund_escrow(total_fare):
            reference = f"REF-{get_random_string(10)}"
            WalletTransaction.objects.create(
                user=ride.passenger,
                amount=total_fare,
                transaction_type="escrow_refund",
                status="completed",
                reference=reference
            )

            return Response({"message": "Escrow funds refunded to user", "reference": reference}, status=status.HTTP_200_OK)
        
        return Response({"error": "Refund failed"}, status=status.HTTP_400_BAD_REQUEST)

class SubmitDisputeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        ride_id = request.data.get("ride_id")
        transaction_id = request.data.get("transaction_id")
        reason = request.data.get("reason")

        if not reason:
            return Response({"error": "Reason for dispute is required."}, status=400)

        ride = CarpoolRide.objects.filter(id=ride_id).first()
        transaction = WalletTransaction.objects.filter(id=transaction_id).first()

        dispute = Dispute.objects.create(user=user, ride=ride, transaction=transaction, reason=reason)
        return Response({"message": "Dispute submitted successfully!", "dispute_id": dispute.id})

"""Users should see the status of disputes they filed."""
# class UserDisputeListView(APIView):
#     permission_classes = [IsAuthenticated]

#     def get(self, request):
#         disputes = Dispute.objects.filter(user=request.user)
#         serializer = DisputeSerializer(disputes, many=True)
#         return Response(serializer.data)

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Dispute
from .serializers import DisputeSerializer

class UserDisputeListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        disputes = Dispute.objects.filter(user=request.user)
        serializer = DisputeSerializer(disputes, many=True)
        return Response(serializer.data)

class CancelRideView(APIView):
    """If a user cancels before the driver starts the ride: Full refund to their wallet.
    I  If the ride is already in progress: Partial refund (admin decides the refund policy).
       If the ride is completed: No refund, but user can dispute if there Is an issue."""
    permission_classes = [IsAuthenticated]

    def post(self, request,  carpoolride_id):
        """Handle ride cancellations and process refunds."""
        from .models import CarpoolRide  # Assuming you have a ride model

        try:
            ride = CarpoolRide.objects.get( carpoolride_id = carpoolride_id)
        except CarpoolRide.DoesNotExist:
            return Response({"error": "Ride not found"}, status=status.HTTP_404_NOT_FOUND)

        if request.user != ride.passenger:
            return Response({"error": "Unauthorized action"}, status=status.HTTP_403_FORBIDDEN)

        # Get user's wallet
        user_wallet, _ = UserWallet.objects.get_or_create(user=ride.passenger)

        # Check ride status
        if ride.status == "pending":
            # Full refund since ride hasn’t started
            refund_amount = ride.fare  
            refund_status = "full_refund"
        elif ride.status == "in_progress":
            # Partial refund policy (50% for now, can be adjusted)
            refund_amount = ride.fare * Decimal(0.5)  
            refund_status = "partial_refund"
        else:
            return Response({"error": "Ride already completed. No refund possible."}, status=status.HTTP_400_BAD_REQUEST)

        # Refund to user wallet
        if refund_amount > 0:
            user_wallet.refund_escrow(refund_amount)

            reference = f"REF-{get_random_string(10)}"
            WalletTransaction.objects.create(
                user=ride.passenger,
                amount=refund_amount,
                transaction_type="ride_refund",
                status="completed",
                reference=reference
            )

            # Mark ride as cancelled
            ride.status = "cancelled"
            ride.save()

            return Response({
                "message": f"Ride cancelled. {refund_status} issued.",
                "refund_amount": str(refund_amount),
                "reference": reference
            }, status=status.HTTP_200_OK)

        return Response({"error": "Refund failed"}, status=status.HTTP_400_BAD_REQUEST)



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
# from .models import UserProfile
 
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
            # if not user.is_email_verified:
            #     return Response({'error': 'Email not verified. Please verify your email first.'}, status=status.HTTP_403_FORBIDDEN)
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
        # return Response({'error': 'Incorrect password.'}, status=status.HTTP_400_BAD_REQUEST)


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

def google_login(request):
    GOOGLE = settings.GOOGLE_OAUTH2_CLIENT_ID
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            token = data.get("token")
            print(f"this is the data : {data}")

            if not token:
                return JsonResponse({"error": "Token is required"}, status=400)

            # Verify the token with Google
            google_user = id_token.verify_oauth2_token(
                token,
                google_requests.Request(),
                settings.GOOGLE_OAUTH2_CLIENT_ID 
            )
            
            print(f"this is the googl client id {GOOGLE}")
            if not google_user:
                return JsonResponse({"error": "Invalid Google token"}, status=400)

            # Extract user info from Google
            email = google_user["email"]
            first_name = google_user.get("given_name", "")
            last_name = google_user.get("family_name", "")
            picture = google_user.get("picture", "")
            google_id = google_user['sub']

            # Check if the user exists, else create a new one
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "first_name": first_name,
                    "last_name": last_name,
                    "profile_picture": picture,  # Assuming Google profile picture URL
                    "is_active": True,
                    "is_email_verified": True,  # Google verifies email
                    "phone_number": f"google_{google_id[:10]}",  # Unique placeholder phone_number
                }
            )

            # Generate JWT tokens
            refresh = RefreshToken.for_user(user)
            access_token = str(refresh.access_token)

            return JsonResponse({
                "message": "Login successful",
                "user": {
                    # "user_id": str(user.id),  # Ensure UUID is returned as a string
                    "id": str(user.id),
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "fullname": user.fullname,
                    "phone_number": user.phone_number,
                    # "is_seller": user.is_seller,
                    # "address": user.address,
                    # "city": user.city,
                    # "country": user.country,
                    # "postal_code": user.postal_code,
                    # "profile_picture": user.profile_picture.url if user.profile_picture else picture,
                    # "date_of_birth": user.date_of_birth,
                    # "gender": user.gender,
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
# class PasswordResetView(APIView):
#     permission_classes = [AllowAny]

#     def post(self, request):
#         token = request.GET.get('token')
#         if not token:
#             return Response({'error': 'Token not provided'}, status=status.HTTP_400_BAD_REQUEST)
#         try:
#             payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
#             if payload.get('reset'):
#                 user = CustomUser.objects.get(id=payload['id'])
#                 serializer = PasswordResetSerializer(data=request.data)
#                 if serializer.is_valid():
#                     user.set_password(serializer.validated_data['password'])
#                     user.save()
#                     return Response({'message': 'Password reset successful'}, status=status.HTTP_200_OK)
#             return Response({'error': 'Invalid token'}, status=status.HTTP_400_BAD_REQUEST)
#         except jwt.ExpiredSignatureError:
#             return Response({'error': 'Token expired'}, status=status.HTTP_400_BAD_REQUEST)
#         except jwt.DecodeError:
#             return Response({'error': 'Invalid token'}, status=status.HTTP_400_BAD_REQUEST)

    #update fcm
class UpdateFCMTokenView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        user.fcm_token = request.data.get('fcm_token')
        user.save()
        return Response({"message": "FCM token updated"}, status=status.HTTP_200_OK)
    
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
# from .serializers import UserProfileSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView as SimpleJWTTokenRefreshView

class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get user profile data"""
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
    

# class UpdateProfileView(APIView):
#     permission_classes = [IsAuthenticated]
    
#     def patch(self, request):
#         """Update user profile data"""
#         serializer = UserProfileSerializer(
#             request.user, 
#             data=request.data, 
#             partial=True
#         )
#         if serializer.is_valid():
#             serializer.save()
#             return Response(serializer.data)
#         return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class TokenRefreshView(SimpleJWTTokenRefreshView):
    permission_classes = [AllowAny]  # Allow anyone to refresh token

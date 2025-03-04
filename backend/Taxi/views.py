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


from .serializers import RideRequestSerializer, CarpoolRideSerializer
from rest_framework.generics import UpdateAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import serializers
from .models import RideRequest, CarpoolRide
# from .serializers import RideRequestSerializer
from .utils import notify_user  # Import notification system

class ApproveRideRequestView(UpdateAPIView):
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


# drivers to reject ride if they want to do so:
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
        
         # Notify the passenger
        message = f"Your ride request for {ride_request.ride.pickup_location} has been declined!"
        notify_user(ride_request.passenger, message)


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

# API Endpoint for Drivers to Post Rides:

class CreateCarpoolRideView(CreateAPIView):
    serializer_class = CarpoolRideSerializer
    permission_classes = [IsAuthenticated]  # Only logged-in users can create rides

    def perform_create(self, serializer):
        serializer.save(driver=self.request.user)
        
# driver to update their location
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import DriverLocation

from geopy.distance import geodesic
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from .models import DriverLocation, RideRequest, CarpoolRide
from .utils import notify_user

class UpdateDriverLocationView(APIView):
    """Update the driver's location and notify passengers when close."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        latitude = request.data.get("latitude")
        longitude = request.data.get("longitude")

        if not latitude or not longitude:
            return Response({"error": "Latitude and Longitude are required."}, status=400)

        # Ensure the driver is part of an active ride
        active_rides = CarpoolRide.objects.filter(driver=user, is_completed=False)
        if not active_rides.exists():
            return Response({"error": "You are not assigned to an active ride."}, status=403)

        # Update or create location
        location, created = DriverLocation.objects.update_or_create(
            driver=user, defaults={"latitude": latitude, "longitude": longitude}
        )

        # Notify accepted passengers if the driver is near their pickup point
        for ride in active_rides:
            for ride_request in RideRequest.objects.filter(ride=ride, status="accepted"):
                pickup_coords = (ride_request.ride.pickup_lat, ride_request.ride.pickup_lng)
                driver_coords = (float(latitude), float(longitude))

                distance = geodesic(driver_coords, pickup_coords).km
                if distance < 0.5:  # Notify if driver is within 500 meters
                    message = f"Your ride is approaching! Get ready for pickup at {ride_request.ride.pickup_location}."
                    notify_user(ride_request.passenger, message)

        return Response({"message": "Driver location updated successfully."})


#passengers view to see drivers location
from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import DriverLocation, RideRequest, CarpoolRide

class GetDriverLocationView(RetrieveAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, ride_id):
        """Fetch the driver's latest location for a specific ride, only for accepted passengers."""
        user = request.user

        # Check if the ride exists
        try:
            ride = CarpoolRide.objects.get(id=ride_id)
        except CarpoolRide.DoesNotExist:
            return Response({"error": "Ride not found."}, status=404)

        # Ensure the user has an accepted request for this ride
        is_accepted_passenger = RideRequest.objects.filter(
            ride=ride, passenger=user, status="accepted"
        ).exists()

        if not is_accepted_passenger:
            return Response({"error": "You are not authorized to view this location."}, status=403)

        # Get the driver's latest location
        try:
            location = DriverLocation.objects.get(driver=ride.driver)
            return Response({
                "latitude": location.latitude,
                "longitude": location.longitude
            })
        except DriverLocation.DoesNotExist:
            return Response({"error": "Driver location not found."}, status=404)

#notify passenger when ride starts
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

        
from rest_framework.viewsets import ModelViewSet
# allow users to filter by is_women_only
class CarpoolRideViewSet(ModelViewSet):
    queryset = CarpoolRide.objects.all()
    serializer_class = CarpoolRideSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        is_women_only = self.request.query_params.get("is_women_only", None)

        # If filtering by women-only rides
        if is_women_only == "true":
            queryset = queryset.filter(is_women_only=True)

        return queryset

# Passengers Search & Join Available Rides  
# Since there are no real-time ride requests, passengers search for trips.
class AvailableRidesView(ListAPIView):
    serializer_class = CarpoolRideSerializer

    def get_queryset(self):
        origin = self.request.query_params.get("origin")
        destination = self.request.query_params.get("destination")
        queryset = CarpoolRide.objects.filter(is_full=False)
        if origin:
            queryset = queryset.filter(origin__icontains=origin)
        if destination:
            queryset = queryset.filter(destination__icontains=destination)
        return queryset

#Passengers Request to Join a Ride (Pending Approval)
# Instead of automatically joining a ride, passengers send a request, and the driver approves or declines.
class RequestToJoinRideView(CreateAPIView):
    serializer_class = RideRequestSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(passenger=self.request.user, status="pending")

# ADMIN

from .utils import verify_national_id
from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from .models import CustomUser
from .serializers import UserKYCSerializer


from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from .models import CustomUser
from .serializers import UserKYCSerializer
from .utils import verify_national_id  # Import our utility function

class VerifyKYCView(generics.UpdateAPIView):
    """Admin can approve/reject KYC after ID verification via eCitizen."""
    queryset = CustomUser.objects.all()
    serializer_class = UserKYCSerializer
    permission_classes = [IsAdminUser]

    def update(self, request, *args, **kwargs):
        user = self.get_object()

        # Ensure National ID is provided
        if not user.national_id:
            return Response({"error": "User has not provided a National ID."}, status=status.HTTP_400_BAD_REQUEST)

        # Check National ID with eCitizen
        if not verify_national_id(user.national_id):
            return Response({"error": "National ID verification failed."}, status=status.HTTP_400_BAD_REQUEST)

        # Approve KYC if ID is valid
        user.is_verified = True
        user.save()

        return Response({"message": "KYC verification approved."}, status=status.HTTP_200_OK)

from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from .models import CustomUser
from .serializers import DriverKYCSerializer
from .utils import verify_driving_license  # Import utility function

class VerifyDriverView(generics.UpdateAPIView):
    """Admin can approve/reject driver after NTSA license verification."""
    queryset = CustomUser.objects.all()
    serializer_class = DriverKYCSerializer
    # permission_classes = [IsAdminUser]
    permission_classes = [IsAuthenticated]
    
    def update(self, request, *args, **kwargs):
        verification_result = verify_driving_license(request)

        if verification_result.get("error"):
            return Response({"error": verification_result["error"]}, status=status.HTTP_400_BAD_REQUEST)

        if verification_result["status"] == "failed":
            return Response({"error": "Driving License verification failed. Check logs for details."}, status=status.HTTP_400_BAD_REQUEST)

        # Approve driver
        request.user.is_driver = True
        request.user.is_verified = True
        request.user.save()

        return Response({"message": "Driver verification approved."}, status=status.HTTP_200_OK)

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

"""Admins can approve a refund, reject a claim, or adjust balances."""
from rest_framework.permissions import IsAdminUser

class ResolveDisputeView(APIView):
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



# passenger dashboard
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import RideRequest, CarpoolRide, DriverLocation

class UserDashboardView(APIView):
    """Fetch dashboard details for a normal user."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # Get upcoming rides
        upcoming_rides = RideRequest.objects.filter(passenger=user, status="accepted").select_related("ride")
        upcoming_data = [
            {
                "ride_id": ride.ride.id,
                "pickup": ride.ride.pickup_location,
                "destination": ride.ride.destination,
                "driver_name": ride.ride.driver.get_full_name(),
                "car_details": ride.ride.car_details,
                "departure_time": ride.ride.departure_time,
            }
            for ride in upcoming_rides
        ]

        # Get past rides
        past_rides = RideRequest.objects.filter(passenger=user, status="completed").select_related("ride")
        past_data = [
            {
                "ride_id": ride.ride.id,
                "pickup": ride.ride.pickup_location,
                "destination": ride.ride.destination,
                "driver_name": ride.ride.driver.get_full_name(),
                "car_details": ride.ride.car_details,
                "departure_time": ride.ride.departure_time,
            }
            for ride in past_rides
        ]

        return Response({
            "upcoming_rides": upcoming_data,
            "ride_history": past_data,
        })

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

class GetDriverLiveLocationView(APIView):
    """Get the live location of the driver for an ongoing ride."""
    permission_classes = [IsAuthenticated]

    def get(self, request, ride_id):
        user = request.user

        # Check if the user is in an accepted ride
        try:
            ride_request = RideRequest.objects.get(ride_id=ride_id, passenger=user, status="accepted")
        except RideRequest.DoesNotExist:
            return Response({"error": "You are not in this ride."}, status=403)

        # Fetch driver's latest location
        try:
            location = DriverLocation.objects.get(driver=ride_request.ride.driver)
            return Response({
                "latitude": location.latitude,
                "longitude": location.longitude
            })
        except DriverLocation.DoesNotExist:
            return Response({"error": "Driver location not available."}, status=404)

#deposit funds into wallet balance
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import WalletTransaction, UserWallet
import requests

# deposit funds to wallet
"""Passengers deposit funds into their wallet balance before booking a ride."""
class DepositToWalletView(APIView):
    def post(self, request):
        user = request.user
        phone_number = request.data.get("phone_number")
        amount = request.data.get("amount")

        # Initiate STK Push
        access_token = get_mpesa_access_token()
        headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
        payload = {
            "BusinessShortCode": settings.MPESA_SHORTCODE,
            "Password": generate_stk_password(),
            "Timestamp": generate_timestamp(),
            "TransactionType": "CustomerPayBillOnline",
            "Amount": amount,
            "PartyA": phone_number,
            "PartyB": settings.MPESA_SHORTCODE,
            "PhoneNumber": phone_number,
            "CallBackURL": settings.MPESA_CALLBACK_URL,
            "AccountReference": f"Wallet-{user.id}",
            "TransactionDesc": "Wallet top-up",
        }

        response = requests.post(settings.MPESA_STK_PUSH_URL, json=payload, headers=headers)

        if response.status_code == 200:
            # Store wallet deposit as pending
            WalletTransaction.objects.create(
                user=user, amount=amount, transaction_type="deposit", status="pending"
            )
            return Response({"message": "Wallet top-up initiated. Approve the STK Push."})
        return Response({"error": "Failed to initiate wallet deposit."}, status=400)

    #Paying for a Ride from the Wallet
"""When a user books a ride, the fare is deducted from their wallet balance instead of using M-Pesa directly."""
class PayForRideWithWalletView(APIView):
    def post(self, request, ride_id):
        user = request.user
        ride = Ride.objects.get(id=ride_id)
        fare = ride.fare

        # Get user's wallet balance
        wallet, _ = UserWallet.objects.get_or_create(user=user)

        if wallet.balance < fare:
            return Response({"error": "Insufficient wallet balance."}, status=400)

        # Deduct ride fare from wallet
        wallet.balance -= fare
        wallet.save()

        # Save transaction
        WalletTransaction.objects.create(
            user=user, amount=fare, transaction_type="ride_payment", status="completed"
        )

        return Response({"message": "Ride payment successful from wallet."})
    #Releasing Payment to Driver’s Wallet
"""Once a ride is completed, funds are transferred from the passenger’s wallet to the driver’s wallet."""
class ReleaseRidePaymentToDriverView(APIView):
    def post(self, request, ride_id):
        try:
            ride = Ride.objects.get(id=ride_id)
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
class WithdrawToMpesaView(APIView):
    def post(self, request):
        user = request.user
        amount = request.data.get("amount")

        # Check wallet balance
        wallet = UserWallet.objects.get(user=user)
        if wallet.balance < amount:
            return Response({"error": "Insufficient wallet balance."}, status=400)

        # Deduct wallet balance
        wallet.balance -= amount
        wallet.save()

        # Initiate M-Pesa B2C Withdrawal
        access_token = get_mpesa_access_token()
        headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
        payload = {
            "InitiatorName": settings.MPESA_INITIATOR,
            "SecurityCredential": settings.MPESA_SECURITY_CREDENTIAL,
            "CommandID": "BusinessPayment",
            "Amount": amount,
            "PartyA": settings.MPESA_SHORTCODE,
            "PartyB": user.phone_number,
            "Remarks": "Driver withdrawal",
            "QueueTimeOutURL": settings.MPESA_B2C_TIMEOUT_URL,
            "ResultURL": settings.MPESA_B2C_RESULT_URL,
            "Occasion": f"Withdrawal-{user.id}",
        }

        response = requests.post(settings.MPESA_B2C_URL, json=payload, headers=headers)

        if response.status_code == 200:
            WalletTransaction.objects.create(
                user=user, amount=amount, transaction_type="withdrawal", status="completed"
            )
            return Response({"message": "Withdrawal request sent to M-Pesa."})
        return Response({"error": "Failed to process withdrawal."}, status=400)

##incase of disputes
"""Users can file disputes for transactions or rides."""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Dispute, Ride, WalletTransaction
from .serializers import DisputeSerializer

class SubmitDisputeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        ride_id = request.data.get("ride_id")
        transaction_id = request.data.get("transaction_id")
        reason = request.data.get("reason")

        if not reason:
            return Response({"error": "Reason for dispute is required."}, status=400)

        ride = Ride.objects.filter(id=ride_id).first()
        transaction = WalletTransaction.objects.filter(id=transaction_id).first()

        dispute = Dispute.objects.create(user=user, ride=ride, transaction=transaction, reason=reason)
        return Response({"message": "Dispute submitted successfully!", "dispute_id": dispute.id})

"""Users should see the status of disputes they filed."""
class UserDisputeListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        disputes = Dispute.objects.filter(user=request.user)
        serializer = DisputeSerializer(disputes, many=True)
        return Response(serializer.data)

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
"""allows users to send funds to another user"""
class TransferFundsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Transfer funds between users securely."""
        recipient_id = request.data.get("recipient_id")
        amount = request.data.get("amount")

        if not recipient_id or not amount or Decimal(amount) <= 0:
            return Response({"error": "Invalid request"}, status=status.HTTP_400_BAD_REQUEST)

        sender_wallet = UserWallet.objects.select_for_update().get(user=request.user)
        
        try:
            recipient_wallet = UserWallet.objects.select_for_update().get(user_id=recipient_id)
        except UserWallet.DoesNotExist:
            return Response({"error": "Recipient not found"}, status=status.HTTP_404_NOT_FOUND)

        # **Transfer Limit Check: Prevent rapid multiple transfers**
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
                    recipient_id=recipient_id,
                    amount=amount,
                    transaction_type="transfer",
                    status="completed",
                    reference=reference
                )

            # **Send Email Notifications**
            subject = "Wallet Transfer Confirmation"
            sender_message = f"You have successfully sent KES {amount} to user {recipient_wallet.user.username}. Transaction Ref: {reference}."
            recipient_message = f"You have received KES {amount} from {request.user.username}. Transaction Ref: {reference}."
            
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

class DisputeRideView(APIView):
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


class CancelRideView(APIView):
    """If a user cancels before the driver starts the ride: Full refund to their wallet.
    I  If the ride is already in progress: Partial refund (admin decides the refund policy).
       If the ride is completed: No refund, but user can dispute if there Is an issue."""
    permission_classes = [IsAuthenticated]

    def post(self, request, ride_id):
        """Handle ride cancellations and process refunds."""
        from .models import CarpoolRide  # Assuming you have a ride model

        try:
            ride = CarpoolRide.objects.get(id=ride_id)
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


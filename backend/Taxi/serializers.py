#  Handles ride listings and ensures drivers can post carpool rides while passengers can view available rides.
from rest_framework import serializers
from .models import CarpoolRide

class CarpoolRideSerializer(serializers.ModelSerializer):
    driver_name = serializers.CharField(source="driver.get_full_name", read_only=True)

    class Meta:
        model = CarpoolRide
        fields = "__all__"
        # fields = [
        #     "id",
        #     "driver",
        #     "driver_name",
        #     "origin",
        #     "destination",
        #     "departure_time",
        #     "available_seats",
        #     "price_per_seat",
        #     "status",
        #     "created_at",
        # ]
        read_only_fields = ["id", "created_at", "driver"]
        def validate(self, data):
            driver = self.context["request"].user  # Get the logged-in user
            
            # Ensure only female drivers can set 'is_women_only'
            if data.get("is_women_only", False) and driver.gender != "female":
                raise serializers.ValidationError("Only female drivers can create Women-Only rides.")

            return data
        
# Handles passenger ride requests and ensures drivers can approve or decline them
from rest_framework import serializers
from .models import RideRequest, Dispute

from rest_framework import serializers
from .models import RideRequest, CarpoolRide

class RideRequestSerializer(serializers.ModelSerializer):
    ride_info = serializers.CharField(source="ride.__str__", read_only=True)
    passenger_name = serializers.CharField(source="passenger.get_full_name", read_only=True)

    class Meta:
        model = RideRequest
        fields = "__all__"
        # fields = [
        #     "id",
        #     "ride",
        #     "ride_info",
        #     "passenger",
        #     "passenger_name",
        #     "seats_requested",
        #     "status",
        #     "payment_status",
        #     "created_at",
        # ]
        read_only_fields = ["id", "created_at", "passenger", "ride"]

    def validate_seats_requested(self, value):
        """Ensure requested seats are within limits."""
        if value < 1:
            raise serializers.ValidationError("You must request at least one seat.")
        return value

    def validate(self, data):
        """Ensure passengers don't request more seats than available and avoid duplicates."""
        ride = data.get("ride")
        passenger = self.context["request"].user  # Get authenticated user
        seats_requested = data.get("seats_requested")
        
        # Restrict Women-Only Rides to Female Passengers
        if ride.is_women_only and passenger.gender != "female":
            raise serializers.ValidationError("This ride is restricted to female passengers only.")


        # Check if passenger has already requested this ride/ Prevent duplicate ride requests
        if RideRequest.objects.filter(ride=ride, passenger=passenger).exists():
            raise serializers.ValidationError("You have already requested this ride.")

        # Check available seats
        if seats_requested > ride.available_seats:
            raise serializers.ValidationError(
                f"Only {ride.available_seats} seats are available."
            )

        return data


# class RideRequestSerializer(serializers.ModelSerializer):
#     ride_info = serializers.CharField(source="ride.__str__", read_only=True)
#     passenger_name = serializers.CharField(source="passenger.get_full_name", read_only=True)

#     class Meta:
#         model = RideRequest
#         fields = [
#             "id",
#             "ride",
#             "ride_info",
#             "passenger",
#             "passenger_name",
#             "seats_requested",
#             "status",
#             "payment_status",
#             "created_at",
#         ]
#         read_only_fields = ["id", "created_at", "passenger", "ride"]


from rest_framework import serializers
from .models import Dispute

class DisputeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Dispute
        fields = "__all__"

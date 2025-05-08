#  Handles ride listings and ensures drivers can post carpool rides while passengers can view available rides.
from rest_framework import serializers
from .models import CarpoolRide

# Handles passenger ride requests and ensures drivers can approve or decline them
from rest_framework import serializers
from .models import RideRequest, Dispute

from rest_framework import serializers
from .models import RideRequest, CarpoolRide
import uuid

class RideRequestSerializer(serializers.ModelSerializer):
    ride_info = serializers.CharField(source="ride.__str__", read_only=True)
    passenger_name = serializers.CharField(source="passenger.fullname", read_only=True)
    ride_status = serializers.CharField(source='ride.status', read_only=True)  # Include ride status
    # pickup_location_label = serializers.CharField(source="pickup_location.label")  # Extract label

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
        read_only_fields = ["ridrequest_id", "created_at", "passenger", "ride_status"]

    def validate_seats_requested(self, value):
        """Ensure requested seats are within limits."""
        if value < 1:
            raise serializers.ValidationError("You must request at least one seat.")
        return value

    def validate(self, data):
        """Ensure passengers don't request more seats than available and avoid duplicates."""
        print(f"this is the data {data}")
        ride = data.get("ride")
        print(f"this is the carpool ride_id {ride}")
        passenger = self.context["request"].user  # Get authenticated user
        seats_requested = data.get("seats_requested")
        
        
        if isinstance(ride, CarpoolRide):
            ride_obj = ride
        else:
        # Convert to UUID if it's a string
            try:
                ride_uuid = uuid.UUID(ride)  # Ensure it's a valid UUID
            except (ValueError, TypeError):
             raise serializers.ValidationError("Invalid ride ID format.")
        
        # Fetch the ride object using UUID
            try:
                ride_obj = CarpoolRide.objects.get(carpoolride_id=ride_uuid)
            except CarpoolRide.DoesNotExist:
                raise serializers.ValidationError("The selected ride does not exist.")

        
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
            
        data["ride"] = ride  
        print(f"this is ride at the end: {data}")
        return data

# class DriverSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = CustomUser
#         fields = ["full_name", "email", "phone_numbe"]
from django.utils import timezone
class CarpoolRideCreateSerializer(serializers.ModelSerializer):
    departure_time = serializers.DateTimeField(format="%Y-%m-%dT%H:%M")

    class Meta:
        model = CarpoolRide
        fields = [
            'origin',
            'destination',
            'departure_time',
            'available_seats',
            'contribution_per_seat',
            'is_women_only',
        ]

    def validate_available_seats(self, value):
        if value < 1:
            raise serializers.ValidationError("At least one seat must be available.")
        return value

    def validate_contribution_per_seat(self, value):
        if value < 0:
            raise serializers.ValidationError("Contribution per seat cannot be negative.")
        return value

    def validate_departure_time(self, value):
        if value < timezone.now():
            raise serializers.ValidationError("Departure time cannot be in the past.")
        return value

    def validate_origin(self, value):
        """Validate that origin is a dict with label, lat, lng."""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Origin must be a JSON object.")
        if not all(key in value for key in ['label', 'lat', 'lng']):
            raise serializers.ValidationError("Origin must contain label, lat, and lng.")
        if not isinstance(value['lat'], (int, float)) or not isinstance(value['lng'], (int, float)):
            raise serializers.ValidationError("Latitude and longitude must be numbers.")
        return value

    def validate_destination(self, value):
        """Validate that destination is a dict with label, lat, lng."""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Destination must be a JSON object.")
        if not all(key in value for key in ['label', 'lat', 'lng']):
            raise serializers.ValidationError("Destination must contain label, lat, and lng.")
        if not isinstance(value['lat'], (int, float)) or not isinstance(value['lng'], (int, float)):
            raise serializers.ValidationError("Latitude and longitude must be numbers.")
        return value

    def validate(self, data):
        driver = self.context["request"].user
        if data.get("is_women_only", False) and driver.gender != "female":
            raise serializers.ValidationError("Only female drivers can create Women-Only rides.")
        return data

    def create(self, validated_data):
        print(f"Validated data for ride creation: {validated_data}")
        # Remove driver if present in validated_data to avoid duplication
        validated_data.pop('driver', None)
        # Create CarpoolRide
        ride = CarpoolRide.objects.create(
            driver=self.context["request"].user,
            **validated_data
        )
        print(f"Created ride: {ride.carpoolride_id}")
        return ride
    

class CarpoolRideSerializer(serializers.ModelSerializer):
    # driver = DriverSerializer(read_only=True)
    requests = RideRequestSerializer(many=True)  # Include all ride requests
    driver_name = serializers.CharField(source="driver.fullname", read_only=True)
    departure_time = serializers.DateTimeField(format="%Y-%m-%dT%H:%M")  # Format for datetime-local
    
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
        read_only_fields = ["carpoolride_id", "created_at", "last_updated", "driver", "requests", "driver_name"]
    def validate_departure_time(self, value):
        if value < timezone.now():
            raise serializers.ValidationError("Departure time cannot be in the past.")
        return value
    
    
    def validate(self, data):
            driver = self.context["request"].user  # Get the logged-in user
            
            # Ensure only female drivers can set 'is_women_only'
            if data.get("is_women_only", False) and driver.gender != "female":
                raise serializers.ValidationError("Only female drivers can create Women-Only rides.")

            return data
        

class RideHistorySerializer(serializers.ModelSerializer):
    driver_contact = serializers.SerializerMethodField()
    passengers_info = serializers.SerializerMethodField()
    total_amount_paid = serializers.SerializerMethodField()
    requests = RideRequestSerializer(many=True)

    class Meta:
        model = CarpoolRide
        fields = [
            'carpoolride_id', 'origin', 'destination', 'departure_time', 'status',
            'driver_contact', 'passengers_info', 'total_amount_paid', 'requests'
        ]

    def get_driver_contact(self, obj):
        user = self.context['request'].user
        ride_requests = obj.requests.filter(passenger=user, status='accepted')
        if ride_requests.exists():
            return {
                'name': obj.driver.fullname,
                'phone': obj.driver.phone_number,
                'email': obj.driver.email
            }
        return None

    def get_passengers_info(self, obj):
        user = self.context['request'].user
        info = []
        for reqs in obj.requests.filter(status='accepted'):
            passenger = reqs.passenger
            data = {
                'name': passenger.fullname,
                'phone': passenger.phone_number,
            }
            if obj.driver == user:
                data.update({
                    'phone': passenger.phone_number,
                    'email': passenger.email,
                    'amount_paid': float(reqs.ride.fare) * reqs.seats_requested
                })
            info.append(data)
        return info

    def get_total_amount_paid(self, obj):
        user = self.context['request'].user
        if obj.driver == user:
            total = 0
            for req in obj.requests.filter(status='accepted'):
                total += float(req.ride.fare) * req.seats_requested
            return total
        return None


from rest_framework import serializers
from .models import Dispute

class DisputeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Dispute
        fields = "__all__"

#vehicle

  #user serializers

##user serializers
from rest_framework import serializers
from .models import CustomUser
from django.core.exceptions import ValidationError

class registeruserserializer(serializers.ModelSerializer):
    password2 = serializers.CharField(write_only=True, required=False, min_length=8)

    class Meta:
        model = CustomUser
        fields = ['id', 'email', 'phone_number', 'first_name', 'last_name', 'gender', 'password', 'password2']
        extra_kwargs = {
            'password': {'write_only': True, 'min_length': 8},
            'email': {'required': True},
            'phone_number': {'required': True},
            'first_name': {'required': True},
            'last_name': {'required': True},
        }

    def validate_email(self, value):
        if CustomUser.objects.filter(email=value.lower()).exists():
            raise ValidationError("Email already exists")
        return value.lower()

    def validate_phone_number(self, value):
        if CustomUser.objects.filter(phone_number=value).exists():
            raise ValidationError("Phone number already exists")
        return value

    def validate(self, data):
        password = data.get('password')
        password2 = data.get('password2', None)

        if password2 and password != password2:
            raise serializers.ValidationError({"password2": "Passwords don't match"})

        return data

    def create(self, validated_data):
        validated_data.pop('password2', None)
        user = CustomUser(
            phone_number=validated_data['phone_number'],
            email=validated_data['email'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
            gender=validated_data.get('gender', ''),
            is_driver=False
        )
        user.set_password(validated_data['password'])
        user.save()
        return user



from rest_framework import serializers
from .models import CustomUser

class UserSerializer(serializers.ModelSerializer):
    """Basic user info for auth"""
    class Meta:
        model = CustomUser
        fields = ['id', 'email', 'first_name', 'last_name', 'phone_number', 'password', 'profile_picture', 'fullname']
        extra_kwargs = {'password': {'write_only': True}, 'profile_picture': {'required': False}}
        
       
    def update(self, instance, validated_data):
        # Update the user instance with new data
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance





class PasswordResetSerializer(serializers.Serializer):
    """Serializer for password reset."""
    password = serializers.CharField(write_only=True, min_length=8)
    password2 = serializers.CharField(write_only=True, min_length=8)

    def validate(self, data):
        if data['password'] != data['password2']:
            raise serializers.ValidationError({"password2": "Passwords don't match"})
        return data
    
# driver registration
from Taxi.models import Vehicle, VehicleMake, VehicleModel
from Taxi.models import CustomUser, VehicleMake, VehicleModel
from rest_framework.exceptions import ValidationError

class VehicleMakeSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='make_id', read_only=True)

    class Meta:
        model = VehicleMake
        fields = ['id', 'name']

class VehicleModelSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='model_id', read_only=True)
    make_id = serializers.UUIDField(source='make.make_id', read_only=True)

    class Meta:
        model = VehicleModel
        fields = ['id', 'make_id', 'name']


# from Taxi.models import CustomUser, Vehicle, VehicleMake, VehicleModel
from Taxi.models import CustomUser, VehicleMake, VehicleModel, Vehicle
from rest_framework.exceptions import ValidationError
from django.core.files.storage import default_storage
import os
from django.db import transaction

class VehicleSerializer(serializers.ModelSerializer):
    make_id = serializers.UUIDField(source='make.make_id')
    model_id = serializers.UUIDField(source='model.model_id')

    class Meta:
        model = Vehicle
        fields = ['make_id', 'model_id', 'plate_number', 'capacity', 'year', 'color', 'vehicle_photo']

    def validate(self, data):
        if not VehicleMake.objects.filter(make_id=data['make']['make_id']).exists():
            raise ValidationError({"make_id": "Invalid vehicle make."})
        if not VehicleModel.objects.filter(model_id=data['model']['model_id'], make__make_id=data['make']['make_id']).exists():
            raise ValidationError({"model_id": "Invalid vehicle model for the selected make."})
        return data

class DriverRegistrationSerializer(serializers.ModelSerializer):
    password2 = serializers.CharField(write_only=True, required=False, min_length=8)
    vehicle = VehicleSerializer()
    id_verification_front = serializers.FileField(write_only=True)
    id_verification_back = serializers.FileField(write_only=True)
    driving_license_file = serializers.FileField(write_only=True)

    class Meta:
        model = CustomUser
        fields = [
            'id', 'email', 'phone_number', 'first_name', 'last_name', 'gender',
            'password', 'password2', 'is_driver', 'id_verification_front', 'id_verification_back',
            'driving_license_number', 'driving_license_file', 'vehicle'
        ]
        extra_kwargs = {
            'password': {'write_only': True, 'min_length': 8},
            'email': {'required': True},
            'phone_number': {'required': True},
            'first_name': {'required': True},
            'last_name': {'required': True},
            'is_driver': {'required': True},
            'id_verification_front': {'required': True},
            'id_verification_back': {'required': True},
            'driving_license_number': {'required': True},
            'driving_license_file': {'required': True},
        }

    def validate_email(self, value):
        if CustomUser.objects.filter(email=value.lower()).exists():
            raise ValidationError("Email already exists")
        return value.lower()

    def validate_phone_number(self, value):
        if CustomUser.objects.filter(phone_number=value).exists():
            raise ValidationError("Phone number already exists")
        return value

    def validate(self, data):
        password = data.get('password')
        password2 = data.get('password2', None)

        if password2 and password != password2:
            raise serializers.ValidationError({"password2": "Passwords don't match"})

        if not data.get('is_driver'):
            raise serializers.ValidationError({"is_driver": "Must be true for driver registration."})

        return data

    def create(self, validated_data):
        vehicle_data = validated_data.pop('vehicle')
        id_verification_front = validated_data.pop('id_verification_front')
        id_verification_back = validated_data.pop('id_verification_back')
        driving_license_file = validated_data.pop('driving_license_file')
        validated_data.pop('password2', None)

        with transaction.atomic():
            user = CustomUser(
                email=validated_data['email'],
                phone_number=validated_data['phone_number'],
                first_name=validated_data['first_name'],
                last_name=validated_data['last_name'],
                gender=validated_data.get('gender', ''),
                is_driver=True,
                driving_license_number=validated_data['driving_license_number']
            )
            user.set_password(validated_data['password'])

            # Save and hash ID verification files
            user.save_id_image(id_verification_front, 'front')
            user.save_id_image(id_verification_back, 'back')

            # Optionally store front ID in id_verification
            id_verification_path = f'kyc_docs/{user.id}/{id_verification_front.name}'
            user.id_verification = default_storage.save(id_verification_path, id_verification_front)

            # Hash and save driving license
            user.save_license_copy(driving_license_file)

            user.save()

            # Create Vehicle instance
            vehicle = Vehicle(
                driver=user,
                make=VehicleMake.objects.get(make_id=vehicle_data['make']['make_id']),
                model=VehicleModel.objects.get(model_id=vehicle_data['model']['model_id']),
                plate_number=vehicle_data['plate_number'],
                capacity=vehicle_data['capacity'],
                year=vehicle_data['year'],
                color=vehicle_data['color'],
            )
            if vehicle_data.get('vehicle_photo'):
                vehicle_photo_path = f'vehicle_photos/{user.id}/{vehicle_data["vehicle_photo"].name}'
                vehicle.vehicle_photo = default_storage.save(vehicle_photo_path, vehicle_data['vehicle_photo'])
            vehicle.save()

            return user

class VehicleMakeSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='make_id', read_only=True)

    class Meta:
        model = VehicleMake
        fields = ['id', 'name']

class VehicleModelSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='model_id', read_only=True)
    make_id = serializers.UUIDField(source='make.make_id', read_only=True)

    class Meta:
        model = VehicleModel
        fields = ['id', 'make_id', 'name']

class registeruserserializer(serializers.ModelSerializer):
    password2 = serializers.CharField(write_only=True, required=False, min_length=8)

    class Meta:
        model = CustomUser
        fields = ['id', 'email', 'phone_number', 'first_name', 'last_name', 'gender', 'password', 'password2']
        extra_kwargs = {
            'password': {'write_only': True, 'min_length': 8},
            'email': {'required': True},
            'phone_number': {'required': True},
            'first_name': {'required': True},
            'last_name': {'required': True},
        }

    def validate_email(self, value):
        if CustomUser.objects.filter(email=value.lower()).exists():
            raise ValidationError("Email already exists")
        return value.lower()

    def validate_phone_number(self, value):
        if CustomUser.objects.filter(phone_number=value).exists():
            raise ValidationError("Phone number already exists")
        return value

    def validate(self, data):
        password = data.get('password')
        password2 = data.get('password2', None)

        if password2 and password != password2:
            raise serializers.ValidationError({"password2": "Passwords don't match"})

        return data

    def create(self, validated_data):
        validated_data.pop('password2', None)
        user = CustomUser(
            phone_number=validated_data['phone_number'],
            email=validated_data['email'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
            gender=validated_data.get('gender', ''),
            is_driver=False
        )
        user.set_password(validated_data['password'])
        user.save()
        return user
#  Handles ride listings and ensures drivers can post carpool rides while passengers can view available rides.
from rest_framework import serializers
from .models import CarpoolRide

# Handles passenger ride requests and ensures drivers can approve or decline them
from rest_framework import serializers
from .models import RideRequest

from rest_framework import serializers
from .models import RideRequest, CarpoolRide
import uuid
from geopy.geocoders import Nominatim
from googlemaps import Client
from django.conf import settings
class RideRequestSerializer(serializers.ModelSerializer):
    ride_info = serializers.CharField(source="ride.__str__", read_only=True)
    passenger_name = serializers.CharField(source="passenger.fullname", read_only=True)
    ride_status = serializers.CharField(source='ride.status', read_only=True)
    dropoff_location = serializers.SerializerMethodField()
    
    class Meta:
        model = RideRequest
        fields = [
            "ridrequest_id",
            "ride",
            "ride_info",
            "ride_status",
            "passenger_name",
            "status",
            "seats_requested",
            "pickup_location",
            "dropoff_location", 
            "created_at",
        ]
        read_only_fields = ["ridrequest_id", "created_at", "passenger", "ride_status"]

    def get_passenger_name(self, obj):
        return f"{obj.passenger.first_name} {obj.passenger.last_name}".strip()
    
    def validate_seats_requested(self, value):
        if value < 1:
            raise serializers.ValidationError("You must request at least one seat.")
        return value

    def validate_pickup_location(self, value):
        return self._validate_location(value, field_name="pickup_location")

    def get_dropoff_location(self, obj):
        # Return ride.destination if dropoff_location is missing
        if obj.dropoff_location:
            return obj.dropoff_location
        elif obj.ride and obj.ride.destination:
            return obj.ride.destination
        return None
    
    def _validate_location(self, value, field_name):
        if isinstance(value, str):
            gmaps = Client(key=settings.GOOGLE_MAPS_API_KEY)
            try:
                result = gmaps.geocode(value, components={"country": "KE"})
                if not result:
                    raise serializers.ValidationError(f"Invalid {field_name}.")
                location = result[0]["geometry"]["location"]
                return {
                    "lat": location["lat"],
                    "lng": location["lng"],
                    "label": result[0]["formatted_address"],
                }
            except Exception as e:
                raise serializers.ValidationError(f"{field_name.capitalize()} geocoding failed: {str(e)}")
        elif isinstance(value, dict):
            if not all(key in value for key in ["lat", "lng", "label"]):
                raise serializers.ValidationError(f"{field_name} must include lat, lng, and label.")
            try:
                float(value["lat"])
                float(value["lng"])
            except (ValueError, TypeError):
                raise serializers.ValidationError("lat and lng must be valid numbers.")
            if value["lat"] == 0 or value["lng"] == 0 or value["lat"] is None or value["lng"] is None:
                raise serializers.ValidationError("lat and lng must be non-zero and non-null.")
            return value
        raise serializers.ValidationError(f"{field_name} must be a string or JSON object.")

    def validate(self, data):
        print(f"Validating data: {data}")
        ride = data.get("ride")
        passenger = self.context["request"].user
        seats_requested = data.get("seats_requested")
        print(f"Passenger: {passenger.id}, {passenger.fullname}")
        print(f"Ride input: {ride}")

        if isinstance(ride, CarpoolRide):
            ride_obj = ride
        else:
            try:
                ride_uuid = uuid.UUID(ride)
            except (ValueError, TypeError):
                raise serializers.ValidationError("Invalid ride ID format.")
            try:
                ride_obj = CarpoolRide.objects.get(carpoolride_id=ride_uuid)
            except CarpoolRide.DoesNotExist:
                raise serializers.ValidationError("The selected ride does not exist.")
        print(f"Retrieved ride object: {ride_obj.carpoolride_id}")

        if ride_obj.is_women_only and passenger.gender != "female":
            raise serializers.ValidationError("This ride is restricted to female passengers only.")

        existing_requests = RideRequest.objects.filter(
            ride=ride_obj,
            passenger=passenger,
            status__in=["pending", "accepted"]
        )
        if existing_requests.exists():
            print(f"Duplicate request found: {list(existing_requests.values('ridrequest_id', 'status'))}")
            raise serializers.ValidationError("You have already requested this ride. Please wait for driver confirmation, Thank you.")

        if seats_requested > ride_obj.available_seats:
            raise serializers.ValidationError(f"Only {ride_obj.available_seats} seats are available.")

        data["ride"] = ride_obj
        print(f"Validated data: {data}")
        return data


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
    make_id = serializers.UUIDField(write_only=True)
    model_id = serializers.UUIDField(write_only=True)
    make_name = serializers.CharField(source='make.name', read_only=True)
    model_name = serializers.CharField(source='model.name', read_only=True)
    vehicle_photo = serializers.SerializerMethodField()  #

    class Meta:
        model = Vehicle
        fields = [
            'make_id', 'model_id',  # IDs for incoming data
            'make_name', 'model_name',  # Names for display
            'plate_number', 'capacity', 'year', 'color', 'vehicle_photo'
        ]
    def get_vehicle_photo(self, obj):
        request = self.context.get('request', None)
        if request and obj.vehicle_photo and hasattr(obj.vehicle_photo, 'url'):
            return request.build_absolute_uri(obj.vehicle_photo.url)
        elif obj.vehicle_photo and hasattr(obj.vehicle_photo, 'url'):
            # Fallback to relative URL if request is missing
            return obj.vehicle_photo.url
        return None

    def validate(self, data):
        make_id = data.get('make_id')
        model_id = data.get('model_id')

        # Validate make_id
        if not VehicleMake.objects.filter(make_id=make_id).exists():
            raise serializers.ValidationError({"make_id": "Invalid vehicle make."})

        # Validate model_id and ensure it belongs to the selected make
        if not VehicleModel.objects.filter(model_id=model_id, make__make_id=make_id).exists():
            raise serializers.ValidationError({"model_id": "Invalid model for the given make."})

        return data

    def create(self, validated_data):
        # Extract make_id and model_id
        make_id = validated_data.pop('make_id')
        model_id = validated_data.pop('model_id')

        # Get make and model instances
        make = VehicleMake.objects.get(make_id=make_id)
        model = VehicleModel.objects.get(model_id=model_id)

        # Create Vehicle instance
        return Vehicle.objects.create( make=make, model=model, **validated_data)
    
    def update(self, instance, validated_data):
        instance.plate_number = validated_data.get('plate_number', instance.plate_number)
        instance.capacity = validated_data.get('capacity', instance.capacity)
        instance.year = validated_data.get('year', instance.year)
        instance.color = validated_data.get('color', instance.color)
        if 'vehicle_photo' in validated_data:
            instance.vehicle_photo = validated_data['vehicle_photo']
        instance.save()
        return instance



from django.utils import timezone
import logging

logger = logging.getLogger(__name__)
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
        driver = self.context["request"].user
        if not driver.is_driver:
            raise serializers.ValidationError("Only drivers can create rides.")
        
        try:
            vehicle = Vehicle.objects.get(driver=driver)
            if value < 1:
                raise serializers.ValidationError("At least one seat must be available.")
            if value > vehicle.capacity:
                raise serializers.ValidationError(
                    f"Available seats cannot exceed vehicle capacity of {vehicle.capacity}."
                )
        except Vehicle.DoesNotExist:
            raise serializers.ValidationError("No vehicle registered for this driver.")
        
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
        driver = self.context["request"].user
        # Attempt to get the driver's vehicle, default to None if it doesn't exist
        vehicle = getattr(driver, 'vehicle', None)
        logger.info(f"Creating ride for driver {driver.id} with vehicle {vehicle.vehicleid if vehicle else 'None'}")
        if not vehicle:
            logger.info(f"Warning: No vehicle associated with driver {driver.id}. Vehicle will be null.")
        # Remove driver if present in validated_data to avoid duplication
        validated_data.pop('driver', None)
        # validated_data.pop('vehicle', None)  # Remove vehicle from validated_data if provided
        # Create CarpoolRide with the driver's vehicle
        ride = CarpoolRide.objects.create(
            driver=driver,
            vehicle=vehicle,  # Assign the driver's vehicle or None
            **validated_data
        )
        print(f"Created ride: {ride.carpoolride_id}")
        return ride
    
    

class CarpoolRideSerializer(serializers.ModelSerializer):
    # driver = DriverSerializer(read_only=True)
    requests = RideRequestSerializer(many=True)  # Include all ride requests
    driver_name = serializers.CharField(source="driver.fullname", read_only=True)
    driver_number = serializers.CharField(source="driver.phone_number", read_only=True)
    departure_time = serializers.DateTimeField(format="%Y-%m-%dT%H:%M")  # Format for datetime-local
    vehicle = VehicleSerializer(read_only=True)
    
    class Meta:
        model = CarpoolRide
        fields = "__all__"
        
        read_only_fields = ["carpoolride_id", "created_at", "last_updated", "driver", "requests", "driver_name", "driver_number", "vehicle"]
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
    requests = RideRequestSerializer(many=True)

    class Meta:
        model = CarpoolRide
        fields = [
            'carpoolride_id', 'origin', 'destination', 'departure_time', 'status',
            'driver_contact', 'passengers_info', 'total_amount_paid', 'requests'
        ]

    def get_driver_contact(self, obj):
        user = self.context['request'].user
        # If user is a passenger (has an accepted ride request)
        ride_requests = obj.requests.filter(passenger=user, status='accepted')
        if ride_requests.exists():
            return {
                'name': obj.driver.fullname,
                'phone': obj.driver.phone_number,
                'email': obj.driver.email,
                'id': str(obj.driver.id)
            }
        # If user is the driver, return their own contact info
        if obj.driver == user:
            return {
                'name': user.fullname,
                'phone': user.phone_number,
                'email': user.email,
                'id': str(user.id)
            }
        return None

    def get_passengers_info(self, obj):
        user = self.context['request'].user
        info = []
        for reqs in obj.requests.filter(status='accepted'):
            passenger = reqs.passenger
            data = {
                'id': str(passenger.id),
                'name': passenger.fullname,
                'phone': passenger.phone_number,
            }
            if obj.driver == user:
                data.update({
                    'phone': passenger.phone_number,
                    'email': passenger.email,
                    'seats_requested': reqs.seats_requested,
                    'amount_paid': float(reqs.ride.contribution_per_seat) * reqs.seats_requested
                })
            info.append(data)
        return info



from rest_framework import serializers




#vehicle

  #user serializers

##user serializers
from rest_framework import serializers
from .models import CustomUser
from django.core.exceptions import ValidationError
import re

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
            'gender': {'required': True},
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
        # Password strength
        if len(data['password']) < 8:
            raise ValidationError({"password": "Password must be at least 8 characters long"})
        # if not re.search(r'[A-Z]', data['password']):
        #     raise ValidationError({"password": "Password must contain at least one uppercase letter"})
        # if not re.search(r'[a-z]', data['password']):
        #     raise ValidationError({"password": "Password must contain at least one lowercase letter"})
        # if not re.search(r'[0-9]', data['password']):
        #     raise ValidationError({"password": "Password must contain at least one digit"})
        # if not re.search(r'[!@#$%^&*(),.?":{}|<>]', data['password']):
        #     raise ValidationError({"password": "Password must contain at least one special character"})
        
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

from Taxi.models import Message
class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    recipient = UserSerializer(read_only=True)
    carpoolride_id = serializers.CharField(source='ride.carpoolride_id', read_only=True)

    class Meta:
        model = Message
        fields = ['message_id', 'sender', 'recipient', 'carpoolride_id', 'content', 'timestamp', 'status']
        read_only_fields = ['message_id', 'sender', 'recipient', 'carpoolride_id', 'content', 'timestamp', 'status']


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


class DriverRegistrationSerializer(serializers.ModelSerializer):
    password2 = serializers.CharField(write_only=True, required=True, min_length=8)
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
            raise serializers.ValidationError("Email already exists")
        return value.lower()

    def validate_phone_number(self, value):
        if CustomUser.objects.filter(phone_number=value).exists():
            raise serializers.ValidationError("Phone number already exists")
        return value

    def validate(self, data):
        password = data.get('password')
        password2 = data.get('password2')

        if password != password2:
            raise serializers.ValidationError({"password2": "Passwords don't match"})

        if not data.get('is_driver'):
            raise serializers.ValidationError({"is_driver": "Must be true for driver registration."})

        return data

    def create(self, validated_data):
        vehicle_data = validated_data.pop('vehicle')
        id_verification_front = validated_data.pop('id_verification_front')
        id_verification_back = validated_data.pop('id_verification_back')
        driving_license_file = validated_data.pop('driving_license_file')
        validated_data.pop('password2')

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

            # Store ID verification
            id_verification_path = f'kyc_docs/{user.id}/{id_verification_front.name}'
            user.id_verification = default_storage.save(id_verification_path, id_verification_front)

            # Save driving license
            user.save_license_copy(driving_license_file)

            user.save()

            # Create Vehicle instance using VehicleSerializer
            vehicle_serializer = VehicleSerializer(data=vehicle_data)
            vehicle_serializer.is_valid(raise_exception=True)
            vehicle = vehicle_serializer.save(driver=user)

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
    
from Taxi.models import UserWallet, ProfileStats, WalletTransaction
from django.db import models
class UserProfileSerializer(serializers.ModelSerializer):
    wallet_balance = serializers.SerializerMethodField()
    vehicle = serializers.SerializerMethodField()
    total_earnings = serializers.SerializerMethodField()
    monthly_earnings = serializers.SerializerMethodField()  # New field for monthly earnings
    # profile_picture = serializers.SerializerMethodField()
    profile_picture = serializers.ImageField(required=False)

    class Meta:
        model = CustomUser
        fields = [
            'id', 'fullname', 'phone_number', 'email', 'is_verified', 'is_email_verified',
            'wallet_balance', 'rating', 'profile_picture', 'gender', 'is_driver',
            'is_available', 'national_id', 'driving_license_number', 'vehicle',
            'total_earnings', 'monthly_earnings'
        ]
        read_only_fields = [
            'email', 'wallet_balance', 'rating', 'is_verified', 'is_email_verified',
            'is_driver', 'is_available', 'national_id', 'driving_license_number',
            'vehicle', 'total_earnings', 'monthly_earnings', 'fullname', 'gender'
        ]
    
    def get_profile_picture(self, obj):
        request = self.context.get('request')
        if obj.profile_picture:
            if request:
                return request.build_absolute_uri(obj.profile_picture.url)
            else:
                # Fallback to relative path if request is not available
                return obj.profile_picture.url
        return None

    def get_wallet_balance(self, obj):
        try:
            return float(obj.wallet.balance)
        except UserWallet.DoesNotExist:
            return 0.00

    def get_vehicle(self, obj):
        if not obj.is_driver:
            return None
        try:
            vehicle = Vehicle.objects.get(driver=obj)
            return VehicleSerializer(vehicle, context={'request': self.context.get('request')}).data
        except Vehicle.DoesNotExist:
            return None

    def get_total_earnings(self, obj):
        try:
            stats = obj.stats
            return float(stats.total_earnings)
        except ProfileStats.DoesNotExist:
            return 0.00

    def get_monthly_earnings(self, obj):
        if not obj.is_driver:
            return 0.00
        try:
            current_year = timezone.now().year
            current_month = timezone.now().month
            earnings = WalletTransaction.objects.filter(
                user=obj,
                transaction_type="escrow_release",
                status="completed",
                created_at__year=current_year,
                created_at__month=current_month
            ).aggregate(total=models.Sum('amount'))['total'] or 0.00
            return float(earnings)
        except Exception as e:
            logger.error(f"Error calculating monthly earnings for user {obj.id}: {e}")
            return 0.00
    def update(self, instance, validated_data):
        instance.first_name = validated_data.get('first_name', instance.first_name)
        instance.last_name = validated_data.get('last_name', instance.last_name)
        
        # Update profile picture (handled by ImageField)
        if 'profile_picture' in validated_data:
            new_picture = validated_data['profile_picture']
            if instance.profile_picture and instance.profile_picture.name != new_picture.name:
                instance.profile_picture.delete(save=False)
            instance.profile_picture = new_picture
            instance.save()  # Sa
            logger.info(f"Updated profile picture for user {instance.id} to {new_picture.name}")
            
        
        # Handle vehicle data if provided
        if instance.is_driver and 'vehicle' in validated_data:
            vehicle_data = validated_data.pop('vehicle')
            vehicle, created = Vehicle.objects.get_or_create(driver=instance)
            vehicle_serializer = VehicleSerializer(vehicle, data=vehicle_data, partial=True)
            if vehicle_serializer.is_valid():
                vehicle_serializer.save()
        return instance
        
class UserWalletBalanceSerializer(serializers.Serializer):
    balance = serializers.SerializerMethodField()

    def get_balance(self, obj):
        try:
            return obj.wallet.balance
        except UserWallet.DoesNotExist:
            return 0.00

        
from Taxi.models import  RideMatch    
class RideMatchSerializer(serializers.ModelSerializer):
    ride = CarpoolRideSerializer()

    class Meta:
        model = RideMatch
        fields = ["id", "ride", "score"]
        
from Taxi.models import UserPreferences
class UserPreferencesSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPreferences
        fields = ['prefers_women_only_rides', 'email_notifications', 'push_notifications']
        
        
from Taxi.models import WalletTransaction
from django.utils.translation import gettext_lazy as _

class WalletTransactionSerializer(serializers.ModelSerializer):
    user = serializers.SlugRelatedField(
        slug_field='email',
        queryset=CustomUser.objects.all(),
        read_only=False
    )
    recipient = serializers.SlugRelatedField(
        slug_field='email',
        queryset=CustomUser.objects.all(),
        read_only=False,
        allow_null=True
    )
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=True)
    transaction_type = serializers.ChoiceField(choices=WalletTransaction.TRANSACTION_TYPES)
    status = serializers.ChoiceField(choices=WalletTransaction.STATUS_CHOICES)
    created_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = WalletTransaction
        fields = [
            'walletTransactionid',
            'user',
            'recipient',
            'sender_name',
            'sender_phone',
            'recipient_name',
            'recipient_phone',
            'amount',
            'transaction_type',
            'status',
            'created_at',
            'reference',
        ]
        read_only_fields = ['walletTransactionid', 'created_at', 'reference']

    def validate(self, data):
        """
        Validate transaction data.
        """
        # Ensure recipient is provided for transfer or escrow_release transactions
        if data.get('transaction_type') in ['transfer', 'escrow_release'] and not data.get('recipient'):
            raise serializers.ValidationError(
                _("Recipient is required for transfer or escrow release transactions.")
            )

        # Ensure amount is positive
        if data.get('amount') <= 0:
            raise serializers.ValidationError(
                _("Amount must be greater than zero.")
            )

        return data

    def to_representation(self, instance):
        """
        Customize output format, e.g., ensure amount is returned as a string.
        """
        ret = super().to_representation(instance)
        ret['amount'] = str(instance.amount)  # Ensure decimal is serialized as string
        return ret
    
# reports
from Taxi.models import Report

class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = ['report_id', 'report_type', 'report_data', 'created_at', 'file_url']
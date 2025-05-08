from django.db import models
import uuid
import hashlib
from django.core.files.storage import default_storage
# from django.contrib.auth.models import User
# Create your models here.
# class UserProfile(models.Model):
#     user = models.OneToOneField(User, on_delete=models.CASCADE)
#     phone_number = models.CharField(max_length=15)
#     profile_picture = models.ImageField(upload_to='profiles/')
#     is_verified = models.BooleanField(default=False)

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models

class CustomUserManager(BaseUserManager):
    def create_user(self, phone_number, email, password=None, **extra_fields):
        if not phone_number:
            raise ValueError("The Phone Number field must be set")
        if not email:
            raise ValueError("Email field must be set")
        
        user = self.model(phone_number=phone_number, email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user
    
    def create_superuser(self, phone_number, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get('is_superuser') is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        
        return self.create_user(phone_number, email, password, **extra_fields)

class CustomUser(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    first_name = models.CharField(max_length=30, blank=True, null=True)
    last_name = models.CharField(max_length=30, blank=True, null=True)
    email=models.EmailField(max_length=254, unique=True, null=False, blank=False)
    fcm_token = models.CharField(max_length=255, blank=True, null=True)  # Store Firebase token
    phone_number = models.CharField(max_length=15, unique=True, null=False, blank=False)
    is_verified = models.BooleanField(default=False)  # KYC status especially for driver
    is_email_verified = models.BooleanField(default=False)  # Track verification status
    profile_picture = models.ImageField(upload_to="profiles/", blank=True, null=True)
    rating = models.FloatField(default=5.0)  # Average rating
    national_id = models.CharField(max_length=10, unique=True, blank=True, null=True)  # Added for eCitizen check
    id_front_hash = models.CharField(max_length=64, blank=True)  # Storing hashed image
    id_back_hash = models.CharField(max_length=64, blank=True)  # Storing hashed image
    driving_license_number = models.CharField(max_length=20, unique=True, null=True, blank=True)# NTSA verification
    driving_license_hash = models.CharField(max_length=64, blank=True)
    is_driver = models.BooleanField(default=False) #
    id_verification = models.FileField(upload_to="kyc_docs/", blank=True, null=True)
    wallet_balance = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    is_active = models.BooleanField(default=True)
    cooldown_until = models.DateTimeField(null=True, blank=True)
    is_available = models.BooleanField(default=False)
    
    is_staff = models.BooleanField(default=False)
    GENDER_CHOICES = [
        ("male", "Male"),
        ("female", "Female"),
        ("other", "Other"),
    ]
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, null=True, blank=True)
    
    objects = CustomUserManager()
    
    USERNAME_FIELD = 'phone_number'
    REQUIRED_FIELDS = ['email']
    
    def save_id_image(self, image_file, side):
        """Hashes the image and stores it securely."""
        image_content = image_file.read()
        image_hash = hashlib.sha256(image_content).hexdigest()
        
        # Store only the hash, not the actual image
        if side == "front":
            self.id_front_hash = image_hash
        elif side == "back":
            self.id_back_hash = image_hash
        self.save()
    
    def save_license_copy(self, license_file):
        """Hashes and stores the digital copy of the driving license securely."""
        license_content = license_file.read()
        self.driving_license_hash = hashlib.sha256(license_content).hexdigest()
        self.save()
    
    @property
    def fullname(self):
        return f"{self.first_name or ''} {self.last_name or ''}".strip()
    
    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.phone_number})"

# vehicle
class VehicleMake(models.Model):
    make_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.name

class VehicleModel(models.Model):
    model_id =models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    make = models.ForeignKey(VehicleMake, on_delete=models.CASCADE, related_name="models")
    name = models.CharField(max_length=50)

    class Meta:
        unique_together = ("make", "name")

    def __str__(self):
        return f"{self.make.name} {self.name}"
class Vehicle(models.Model):
    vehicleid = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    driver = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name="vehicle")
    # make = models.CharField(max_length=50)  # Toyota, Nissan, etc.
    # model = models.CharField(max_length=50)  # Corolla, Note, etc.
    make = models.ForeignKey(VehicleMake, on_delete=models.SET_NULL, null=True)
    model = models.ForeignKey(VehicleModel, on_delete=models.SET_NULL, null=True)
    plate_number = models.CharField(max_length=15, unique=True)
    capacity = models.IntegerField(default=4)
    year = models.IntegerField()
    vehicle_photo = models.ImageField(upload_to="vehicle_photos/", null=True, blank=True)
    color = models.CharField(max_length=20, blank=True)  # Add color field
    verified = models.BooleanField(default=False)  # Approved by admin
    

# ride
# class Ride(models.Model):
#     id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
#     driver = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="rides")
#     vehicle = models.ForeignKey(Vehicle, on_delete=models.SET_NULL, null=True, related_name="rides")
#     start_location = models.CharField(max_length=255)
#     destination = models.CharField(max_length=255)
#     departure_time = models.DateTimeField()
#     available_seats = models.IntegerField()
#     price_per_seat = models.DecimalField(max_digits=10, decimal_places=2)
#     is_completed = models.BooleanField(default=False)
#     is_cancelled = models.BooleanField(default=False)
#     created_at = models.DateTimeField(auto_now_add=True)
    
    
# store drivers location
import googlemaps
from django.db import models
from django.conf import settings
# from django.contrib.gis.db import models as gis_models  # GeoDjango for geolocation
from django.contrib.auth import get_user_model
from geopy.distance import geodesic
from django.db.models import JSONField
# gmaps = googlemaps.Client(key=settings.GOOGLE_MAPS_API_KEY)

CustomUser = get_user_model()

class DriverLocation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    driver = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name="location")
    latitude = models.FloatField()
    longitude = models.FloatField()
    updated_at = models.DateTimeField(auto_now=True)
    
    def distance_to(self, passenger_lat, passenger_lng):
        """Calculate distance between driver and passenger."""
        driver_coords = (self.latitude, self.longitude)
        passenger_coords = (passenger_lat, passenger_lng)
        return geodesic(driver_coords, passenger_coords).meters  # Returns distance in meters

    #the ride itself
class CarpoolRide(models.Model):
    carpoolride_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    driver = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="ride_driver")
    vehicle = models.ForeignKey(Vehicle, on_delete=models.SET_NULL, null=True, related_name="rides")
    
    origin = models.JSONField()  # expects dict with keys: label, lat, lng
    destination = models.JSONField()

    # origin = models.CharField(max_length=255)
    # destination = models.CharField(max_length=255)
    departure_time = models.DateTimeField()
    available_seats = models.IntegerField(default=1)
    contribution_per_seat = models.DecimalField(max_digits=10, decimal_places=2)
    is_full = models.BooleanField(default=False)  # Auto-update when full
    is_completed=models.BooleanField(default=False)
    is_women_only = models.BooleanField(default=False)  # Restricts ride to female passengers only
    is_cancelled = models.BooleanField(default=False)
    fare = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    last_updated = models.DateTimeField(auto_now=True)
    status = models.CharField(
        max_length=20,
        choices=[("pending", "Pending"), ("in_progress", "In_progress"), ("completed", "Completed")],
        default="pending"
    )

    def save(self, *args, **kwargs):
        if self.is_women_only and self.driver.gender != "female":
            raise ValueError("Only female drivers can create Women-Only rides.")
        super().save(*args, **kwargs)
    # def __str__(self):
    #     return f"Ride by {self.driver.get_full_name()} from {self.origin.get('label')} ➜ {self.destination.get('label')}"


# ride request  ////Stores requests from passengers to book a ride.
class RideRequest(models.Model):
    ridrequest_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ride = models.ForeignKey(CarpoolRide, on_delete=models.CASCADE, related_name="requests")
    passenger = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="ride_requests")
    # seats_requested = models.IntegerField()
    seats_requested = models.PositiveIntegerField(default=1)# updated seat
    # origin
    #  pickup_location = models.CharField(max_length=255, blank=True, null=True)
    # pickup_location = models.CharField(max_length=255)  # Unique per passenger
    pickup_location = models.JSONField()  # Structured: label, lat, lng
    dropoff_location = models.JSONField(blank=True, null=True)
    # destination
    # dropoff_location = models.CharField(max_length=255, blank=True, null=True)  # Optional
    
    status = models.CharField(
        max_length=20,
        choices=[("pending", "Pending"), ("accepted", "Accepted"), ("declined", "Declined")],
        default="pending"
    )
    payment_status = models.CharField(
        max_length=20,
        choices=[("unpaid", "Unpaid"), ("paid", "Paid"), ("refunded", "Refunded")],
        default="unpaid"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
#get driver location:class UserLocation(models.Model):
class UserLocation(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='locations')
    ride = models.ForeignKey(CarpoolRide, on_delete=models.SET_NULL, null=True, blank=True, related_name='driver_location')
    latitude = models.FloatField()
    longitude = models.FloatField()
    updated_at = models.DateTimeField(auto_now=True)
    is_simulated = models.BooleanField(default=False)
    carpoolride = models.ForeignKey(
        CarpoolRide,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    class Meta:
        indexes = [
            models.Index(fields=['user', 'ride']),
            models.Index(fields=['updated_at']),
        ]

    def __str__(self):
        return f"Driver location for {self.user.fullname} at ({self.latitude}, {self.longitude})"

# payment  /// Handles Pesapal payments & wallet transactions.
class Payment(models.Model):
    paymentid = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ride_request = models.OneToOneField(RideRequest, on_delete=models.CASCADE, related_name="payment")
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="payments")
    transaction_id = models.CharField(max_length=50, unique=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(
        max_length=20,
        choices=[("pending", "Pending"), ("completed", "Completed"), ("failed", "Failed")],
        default="pending"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
class WalletTopUpRequest(models.Model):
    PAYMENT_METHODS = [
        ("mpesa", "M-Pesa"),
        ("card", "Card"),
        ("bank_transfer", "Bank Transfer"),
        ("crypto", "Crypto"),
        ("mock", "Mock"),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="wallet_topups")
    phone_number = models.CharField(max_length=20)  # Number initiating the payment
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    transaction_id = models.CharField(max_length=50, unique=True)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHODS, default="mock")
    status = models.CharField(max_length=20, choices=[
        ("pending", "Pending"), ("completed", "Completed"), ("failed", "Failed")
    ])
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.phone_number} → {self.phone_number} | {self.amount} [{self.status}]"


from django.utils.translation import gettext_lazy as _
class UserWallet(models.Model):
    userWalletid = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name="wallet")
    balance = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    escrow_balance = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)  # Holds payments before release
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.fullname}'s Wallet - Balance: {self.balance}, Escrow: {self.escrow_balance}"

    def deposit(self, amount):
        """Deposit funds into wallet."""
        self.balance += amount
        self.save()

    def hold_in_escrow(self, amount):
        """Hold money in escrow before ride completion."""
        if self.balance >= amount:
            self.balance -= amount
            self.escrow_balance += amount
            self.save()
            return True
        return False  # Insufficient balance

    def release_escrow(self, amount):
        """Release escrow funds to driver."""
        if self.escrow_balance >= amount:
            self.escrow_balance -= amount
            self.save()
            return True
        return False  # Not enough in escrow

    def refund_escrow(self, amount):
        """Refund escrow funds to user in case of dispute."""
        if self.escrow_balance >= amount:
            self.escrow_balance -= amount
            self.balance += amount
            self.save()
            return True
        return False  # Not enough in escrow

class WalletTransaction(models.Model):
    walletTransactionid = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    TRANSACTION_TYPES = [
        ("deposit", _("Deposit")),
        ("withdrawal", _("Withdrawal")),
        ("transfer", _("Transfer")),
        ("escrow_hold", _("Escrow Hold")),
        ("escrow_release", _("Escrow Release")),
        ("escrow_refund", _("Escrow Refund")),
    ]

    STATUS_CHOICES = [
        ("pending", _("Pending")),
        ("completed", _("Completed")),
        ("failed", _("Failed")),
    ]

    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="transactions")
    recipient = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="received_transactions")  # For transfers
    
    sender_name = models.CharField(max_length=100, blank=True)  # Store sender's full name
    sender_phone = models.CharField(max_length=15, blank=True)  # Store sender's phone number
    recipient_name = models.CharField(max_length=100, blank=True, null=True)  # Store recipient's full name
    recipient_phone = models.CharField(max_length=15, blank=True, null=True)  # Store recipient's phone number
    
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)
    reference = models.CharField(max_length=100, unique=True)  # Unique transaction ID

    def __str__(self):
        return f"{self.transaction_type} - {self.amount} by {self.sender_name} ({self.status})"

            #to handle dispute especially during cancellation
from django.db import models
from django.contrib.auth.models import User

class Dispute(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("resolved", "Resolved"),
        ("rejected", "Rejected"),
    ]

    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    ride = models.ForeignKey("CarpoolRide", on_delete=models.SET_NULL, null=True, blank=True)
    transaction = models.ForeignKey("WalletTransaction", on_delete=models.SET_NULL, null=True, blank=True)
    reason = models.TextField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="pending")
    resolution_notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Dispute by {self.user.first_name} - {self.status}"


# review
class Review(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ride = models.ForeignKey(CarpoolRide, on_delete=models.CASCADE, related_name="reviews")
    reviewer = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="given_reviews")
    reviewed_user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="received_reviews")
    rating = models.IntegerField(default=5)  # 1 to 5
    comment = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

# Tracks suspicious transactions & ride cancellations.
class FraudLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="fraud_logs")
    issue_type = models.CharField(max_length=50)  # Payment fraud, Fake ride, etc.
    description = models.TextField()
    flagged_at = models.DateTimeField(auto_now_add=True)
    is_resolved = models.BooleanField(default=False)


from django.db import models
from django.utils.timezone import now

class NTSAVerificationLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey("CustomUser", on_delete=models.CASCADE, related_name="ntsa_verifications")
    driving_license_number = models.CharField(max_length=15)
    status = models.CharField(max_length=10, choices=[("success", "Success"), ("failed", "Failed")])
    response_data = models.JSONField(null=True, blank=True)  # Store API response for debugging
    created_at = models.DateTimeField(default=now)
    timestamp = models.DateTimeField(auto_now_add=True)  # Track when verification happened


    def __str__(self):
        return f"{self.user.phone_number} - {self.status} ({self.created_at})"

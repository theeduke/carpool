from django.test import TestCase

# Create your tests here.
from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import datetime
import uuid
import json

from Taxi.models import CarpoolRide  # Adjust to your app's model

User = get_user_model()

class AuthenticationTests(TestCase):
    def setUp(self):
        # Create test users
        self.driver = User.objects.create_user(
            phone_number='0790000002',
            password='Admin@123',
            role='Driver'
        )
        self.passenger1 = User.objects.create_user(
            phone_number='0790000004',
            password='Passenger@123',
            role='Passenger'
        )
        self.passenger2 = User.objects.create_user(
            phone_number='0790000066',
            password='Pass@1234',
            role='Passenger'
        )

    def test_login_driver_success(self):
        """TC001: Test successful driver login"""
        response = self.client.post(reverse('login'), {
            'phone_number': '0790000002',
            'password': 'Admin@123'
        })
        self.assertEqual(response.status_code, 302)  # Redirect on success
        self.assertRedirects(response, reverse('driver_home'))
        user = self.client.session.get('_auth_user_id')
        self.assertTrue(user)
        logged_in_user = User.objects.get(id=user)
        self.assertEqual(logged_in_user.role, 'Driver')

    def test_login_passenger_success_1(self):
        """TC002: Test successful passenger login"""
        response = self.client.post(reverse('login'), {
            'phone_number': '0790000004',
            'password': 'Passenger@123'
        })
        self.assertEqual(response.status_code, 302)
        self.assertRedirects(response, reverse('passenger_home'))
        user = self.client.session.get('_auth_user_id')
        self.assertTrue(user)
        logged_in_user = User.objects.get(id=user)
        self.assertEqual(logged_in_user.role, 'Passenger')

    def test_login_passenger_success_2(self):
        """TC003: Test another successful passenger login"""
        response = self.client.post(reverse('login'), {
            'phone_number': '0790000066',
            'password': 'Pass@1234'
        })
        self.assertEqual(response.status_code, 302)
        self.assertRedirects(response, reverse('passenger_home'))
        user = self.client.session.get('_auth_user_id')
        self.assertTrue(user)
        logged_in_user = User.objects.get(id=user)
        self.assertEqual(logged_in_user.role, 'Passenger')

    def test_login_invalid_credentials(self):
        """TC004: Test login with invalid credentials"""
        response = self.client.post(reverse('login'), {
            'phone_number': '0790288746',
            'password': 'Wrong Pass'
        })
        self.assertEqual(response.status_code, 200)  # Stays on login page
        self.assertContains(response, 'Invalid phone number or password')
        self.assertFalse(self.client.session.get('_auth_user_id'))

class TaxiCarpoolRideTests(TestCase):
    def setUp(self):
        # Create a driver for ride creation
        self.driver1 = User.objects.create_user(
            phone_number='0790000001',
            password='Driver@123',
            role='Driver'
        )
        self.driver2 = User.objects.create_user(
            phone_number='0790000002',
            password='Driver@123',
            role='Driver'
        )
        self.driver3 = User.objects.create_user(
            phone_number='0790000003',
            password='Driver@123',
            role='Driver'
        )
        self.driver4 = User.objects.create_user(
            phone_number='0790000004',
            password='Driver@123',
            role='Driver'
        )

    def test_create_carpool_ride_1(self):
        """TC001: Test carpool ride creation"""
        self.client.login(phone_number='0790000001', password='Driver@123')
        ride_data = {
            'carpoolride_id': '550e8400-e29b-41d4-a716-446655440007',
            'origin': json.dumps({'lat': -1.2921, 'lng': 36.8219, 'label': 'Nairobi CBD'}),
            'destination': json.dumps({'lat': -1.2630, 'lng': 36.7910, 'label': 'JKIA'}),
            'departure_time': '2025-06-10 08:00:00+03',
            'available_seats': 3,
            'contribution_per_seat': 200.00,
            'is_women_only': False
        }
        response = self.client.post(reverse('create_ride'), ride_data)
        self.assertEqual(response.status_code, 302)
        ride = CarpoolRide.objects.get(carpoolride_id='550e8400-e29b-41d4-a716-446655440007')
        self.assertEqual(ride.origin, {'lat': -1.2921, 'lng': 36.8219, 'label': 'Nairobi CBD'})
        self.assertEqual(ride.destination, {'lat': -1.2630, 'lng': 36.7910, 'label': 'JKIA'})
        self.assertEqual(ride.available_seats, 3)
        self.assertEqual(ride.contribution_per_seat, 200.00)
        self.assertFalse(ride.is_women_only)
        self.assertEqual(ride.driver_id, self.driver1.id)

    def test_create_carpool_ride_women_only(self):
        """TC002: Test women-only carpool ride creation"""
        self.client.login(phone_number='0790000002', password='Driver@123')
        ride_data = {
            'carpoolride_id': '550e8400-e29b-41d4-a716-446655440008',
            'origin': json.dumps({'lat': -1.2833, 'lng': 36.8172, 'label': 'Westlands'}),
            'destination': json.dumps({'lat': -1.2921, 'lng': 36.8219, 'label': 'Nairobi CBD'}),
            'departure_time': '2025-06-10 09:00:00+03',
            'available_seats': 2,
            'contribution_per_seat': 150.00,
            'is_women_only': True
        }
        response = self.client.post(reverse('create_ride'), ride_data)
        self.assertEqual(response.status_code, 302)
        ride = CarpoolRide.objects.get(carpoolride_id='550e8400-e29b-41d4-a716-446655440008')
        self.assertEqual(ride.origin, {'lat': -1.2833, 'lng': 36.8172, 'label': 'Westlands'})
        self.assertEqual(ride.destination, {'lat': -1.2921, 'lng': 36.8219, 'label': 'Nairobi CBD'})
        self.assertEqual(ride.available_seats, 2)
        self.assertEqual(ride.contribution_per_seat, 150.00)
        self.assertTrue(ride.is_women_only)
        self.assertEqual(ride.driver_id, self.driver2.id)

    def test_create_carpool_ride_mixed_gender(self):
        """TC003: Test mixed-gender carpool ride creation"""
        self.client.login(phone_number='0790000003', password='Driver@123')
        ride_data = {
            'carpoolride_id': '550e8400-e29b-41d4-a716-446655440009',
            'origin': json.dumps({'lat': -1.3000, 'lng': 36.8000, 'label': 'Industrial Area'}),
            'destination': json.dumps({'lat': -1.2833, 'lng': 36.8172, 'label': 'Westlands'}),
            'departure_time': '2025-06-10 10:00:00+03',
            'available_seats': 5,
            'contribution_per_seat': 250.00,
            'is_women_only': False
        }
        response = self.client.post(reverse('create_ride'), ride_data)
        self.assertEqual(response.status_code, 302)
        ride = CarpoolRide.objects.get(carpoolride_id='550e8400-e29b-41d4-a716-446655440009')
        self.assertEqual(ride.origin, {'lat': -1.3000, 'lng': 36.8000, 'label': 'Industrial Area'})
        self.assertEqual(ride.destination, {'lat': -1.2833, 'lng': 36.8172, 'label': 'Westlands'})
        self.assertEqual(ride.available_seats, 5)
        self.assertEqual(ride.contribution_per_seat, 250.00)
        self.assertFalse(ride.is_women_only)
        self.assertEqual(ride.driver_id, self.driver3.id)

    def test_create_carpool_ride_cancelled(self):
        """TC004: Test cancelled carpool ride creation"""
        self.client.login(phone_number='0790000004', password='Driver@123')
        ride_data = {
            'carpoolride_id': '550e8400-e29b-41d4-a716-446655440010',
            'origin': json.dumps({'lat': -1.2700, 'lng': 36.8300, 'label': 'Upper Hill'}),
            'destination': json.dumps({'lat': -1.2921, 'lng': 36.8219, 'label': 'Nairobi CBD'}),
            'departure_time': '2025-06-10 11:00:00+03',
            'available_seats': 4,
            'contribution_per_seat': 180.00,
            'is_women_only': False,
            'is_cancelled': True
        }
        response = self.client.post(reverse('create_ride'), ride_data)
        self.assertEqual(response.status_code, 302)
        ride = CarpoolRide.objects.get(carpoolride_id='550e8400-e29b-41d4-a716-446655440010')
        self.assertEqual(ride.origin, {'lat': -1.2700, 'lng': 36.8300, 'label': 'Upper Hill'})
        self.assertEqual(ride.destination, {'lat': -1.2921, 'lng': 36.8219, 'label': 'Nairobi CBD'})
        self.assertEqual(ride.available_seats, 0)  # Cancelled ride has 0 seats
        self.assertEqual(ride.contribution_per_seat, 180.00)
        self.assertFalse(ride.is_women_only)
        self.assertTrue(ride.is_cancelled)
        self.assertEqual(ride.driver_id, self.driver4.id)
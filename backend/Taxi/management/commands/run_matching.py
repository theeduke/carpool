from django.core.management.base import BaseCommand
from Taxi.tasks import match_passengers_to_rides

class Command(BaseCommand):
    help = 'Manually run the passenger-to-ride matching task'

    def handle(self, *args, **options):
        self.stdout.write("Running matching task...")
        match_passengers_to_rides()
        self.stdout.write(self.style.SUCCESS("Matching task completed."))
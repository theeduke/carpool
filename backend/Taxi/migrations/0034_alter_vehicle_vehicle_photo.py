# Generated by Django 5.1.4 on 2025-06-05 21:10

import Taxi.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('Taxi', '0033_wallettransaction_taxi_wallet_created_d6c922_idx'),
    ]

    operations = [
        migrations.AlterField(
            model_name='vehicle',
            name='vehicle_photo',
            field=models.ImageField(blank=True, null=True, upload_to='vehicle_photos/', validators=[Taxi.models.validate_image]),
        ),
    ]

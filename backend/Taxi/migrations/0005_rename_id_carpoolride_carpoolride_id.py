# Generated by Django 5.1.4 on 2025-03-21 15:17

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('Taxi', '0004_rename_id_riderequest_ridrequest_id_and_more'),
    ]

    operations = [
        migrations.RenameField(
            model_name='carpoolride',
            old_name='id',
            new_name='carpoolride_id',
        ),
    ]

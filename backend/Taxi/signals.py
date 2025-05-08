from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import UserWallet, CustomUser

@receiver(post_save, sender=UserWallet)
def update_wallet_balance(sender, instance, **kwargs):
    """Sync UserWallet balance to CustomUser wallet_balance"""
    if instance.user:
        instance.user.wallet_balance = instance.balance
        instance.user.save(update_fields=["wallet_balance"])
        
@receiver(post_save, sender=CustomUser)
def create_user_wallet(sender, instance, created, **kwargs):
    """Automatically create a wallet when a new user is created"""
    if created and not hasattr(instance, 'wallet'):
        UserWallet.objects.create(user=instance)
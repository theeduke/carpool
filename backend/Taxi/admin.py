from django.contrib import admin
from .models import CustomUser, NTSAVerificationLog

# Register your models here.
@admin.action(description="Reset cooldown for selected users")
def reset_cooldown(modeladmin, request, queryset):
    queryset.update(cooldown_until=None)
    
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ("phone_number", "is_verified", "is_driver", "cooldown_until")
    list_filter = ("is_verified", "is_driver", "cooldown_until")
    actions = [reset_cooldown]  # Admin action to reset users cooldowb

admin.site.register(CustomUser, CustomUserAdmin)
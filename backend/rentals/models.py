from django.db import models

class Property(models.Model):
    name = models.CharField(max_length=150)

    def __str__(self):
        return self.name

class Unit(models.Model):
    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='units')
    unit_code = models.CharField(max_length=10, unique=True)  # e.g., A1, B4, C2
    block = models.CharField(max_length=5)                     # e.g., A, B, C
    rent = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return self.unit_code

class Tenant(models.Model):
    unit = models.ForeignKey(Unit, on_delete=models.SET_NULL, null=True, blank=True, related_name='tenants')
    name = models.CharField(max_length=150)
    phone = models.CharField(max_length=25)
    id_number = models.CharField(max_length=50, blank=True)
    rent = models.DecimalField(max_digits=10, decimal_places=2)
    balance = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=20, default='active')  # active, inactive
    notice_vacate_date = models.DateField(null=True, blank=True)
    notice_submitted_at = models.DateTimeField(null=True, blank=True)
    moved_out_at = models.DateTimeField(null=True, blank=True)
    since = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.unit})"

class Application(models.Model):
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE)
    name = models.CharField(max_length=150)
    phone = models.CharField(max_length=25)
    id_number = models.CharField(max_length=50)
    move_in = models.DateField()
    source = models.CharField(max_length=50, default='QR code')
    status = models.CharField(max_length=20, default='pending')  # pending, approved, rejected
    reason = models.CharField(max_length=150, blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(null=True, blank=True)

class Payment(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    receipt = models.CharField(max_length=30)
    method = models.CharField(max_length=30, default='M-Pesa')
    date = models.DateTimeField(auto_now_add=True)

class MaintenanceTicket(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='tickets')
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE)
    category = models.CharField(max_length=100)
    description = models.TextField()
    photo = models.TextField(blank=True, null=True)  # Stores base64 or SVG data URLs
    status = models.CharField(max_length=30, default='Open')  # Open, In progress, Resolved
    assigned_to = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
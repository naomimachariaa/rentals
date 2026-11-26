# backend/rentals/seed.py
from datetime import date, timedelta
from rentals.models import Property, Unit, Tenant, Application, Payment, MaintenanceTicket

def run():
    Property.objects.all().delete()

    Tenant.objects.all().delete()
    Property.objects.all().delete()

    prop = Property.objects.create(name="Mwangaza Court")

    rent_of = {'A': 15000, 'B': 20000, 'C': 25000}
    units = {}
    for b in ['A', 'B', 'C']:
        for n in [1, 2, 3, 4]:
            code = f"{b}{n}"
            units[code] = Unit.objects.create(property=prop, unit_code=code, block=b, rent=rent_of[b])

    tenant_seed = [
        ('Peter Otieno', 'A1', '0722410001', 0, None),
        ('Grace Muthoni', 'A2', '0733410002', 15000, None),
        ('James Kiptoo', 'A4', '0711410004', 0, None),
        ('Faith Achieng', 'B1', '0722410011', 0, None),
        ('Samuel Mwangi', 'B3', '0745410013', 40000, None),
        ('Amina Wanjiru', 'B4', '0712345678', 20000, None),
        ('Lucy Njeri', 'C1', '0722410021', 0, date.today() + timedelta(days=40)),
        ('David Omondi', 'C2', '0799410022', 0, None),
        ('Hassan Abdi', 'C3', '0733410023', 12500, None),
    ]
    tenants = {}
    for name, u_code, phone, bal, notice_dt in tenant_seed:
        tenants[u_code] = Tenant.objects.create(
            unit=units[u_code], name=name, phone=phone,
            rent=rent_of[u_code[0]], balance=bal,
            notice_vacate_date=notice_dt
        )

    for u_code, amt, rcpt in [
        ('A1', 15000, 'SGJ2M7KQ1A'),
        ('A4', 15000, 'SGJ3P8LR2B'),
        ('B1', 20000, 'SGK4Q9MS3C'),
        ('C1', 25000, 'SGK5R1NT4D'),
        ('C2', 25000, 'SGL6S2PU5E'),
        ('C3', 12500, 'SGL7T3QV6F'),
        ('B4', 20000, 'SGH4K2L9XP'),
    ]:
        Payment.objects.create(tenant=tenants[u_code], amount=amt, receipt=rcpt)

    for name, phone, id_num, u_code, days in [
        ('Brian Kamau', '0722889901', '31245678', 'A3', 10),
        ('Mercy Chebet', '0711223344', '29876543', 'A3', 14),
        ('Esther Wambui', '0745667788', '33451209', 'B2', 7),
        ('Kevin Mutua', '0799001122', '30112233', 'C4', 21),
    ]:
        Application.objects.create(
            unit=units[u_code], name=name, phone=phone,
            id_number=id_num, move_in=date.today() + timedelta(days=days)
        )

    MaintenanceTicket.objects.create(
        tenant=tenants['C3'], unit=units['C3'], category='Plumbing',
        description='The bathroom sink drains very slowly and there is a bad smell coming from the pipe.',
        status='Open'
    )
    MaintenanceTicket.objects.create(
        tenant=tenants['A2'], unit=units['A2'], category='Electrical',
        description='The socket in the living room sparks whenever I plug something in. I have stopped using it.',
        status='In progress', assigned_to='Caretaker'
    )
    MaintenanceTicket.objects.create(
        tenant=tenants['B3'], unit=units['B3'], category='Security and locks',
        description='The padlock on the back stairs gate is broken and the gate will not stay closed.',
        status='Resolved', assigned_to='Caretaker'
    )
    print("Seeded Mwangaza Court successfully!")
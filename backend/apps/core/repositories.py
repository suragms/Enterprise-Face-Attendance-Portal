from django.core.exceptions import ObjectDoesNotExist

class BaseRepository:
    """
    Base Repository class containing standard CRUD wrappers for Django ORM.
    Acts as a mediator between domain logic and persistence models.
    """
    model = None

    def __init__(self):
        if self.model is None:
            raise NotImplementedError("Repository subclasses must define a 'model' attribute.")

    def all(self):
        """Retrieve all instances of the model."""
        return self.model.objects.all()

    def filter(self, **kwargs):
        """Retrieve instances filtered by standard kwargs."""
        return self.model.objects.filter(**kwargs)

    def get_by_id(self, pk):
        """
        Safely retrieve a single instance by primary key.
        Returns None if the entity does not exist.
        """
        try:
            return self.model.objects.get(pk=pk)
        except ObjectDoesNotExist:
            return None

    def create(self, **fields):
        """Instantiate and persist a new model record."""
        return self.model.objects.create(**fields)

    def update(self, instance, **fields):
        """Update and persist fields on an existing model instance."""
        for attr, value in fields.items():
            setattr(instance, attr, value)
        instance.save()
        return instance

    def delete(self, instance):
        """Remove a model instance from the database."""
        return instance.delete()

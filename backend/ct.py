from geopy.geocoders import Nominatim
import ssl
import certifi

# create SSL context with certifi root certificates
ssl_context = ssl.create_default_context(cafile=certifi.where())

# initialize geolocator
geolocator = Nominatim(
    user_agent="my_app",
    adapter_factory=lambda **kwargs: Nominatim._DEFAULT_ADAPTER_CLASS(ssl_context=ssl_context)
)

location = geolocator.geocode("401 Avery Co High School Rd")
print(location.latitude, location.longitude)
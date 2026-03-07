import rasterio #purely for testing the geotiff file, not used in the actual app.py code
import numpy as np
import matplotlib.pyplot as plt


tif_path = "avtif.tif"  
with rasterio.open(tif_path) as src:
    data = src.read(1)  

print("Shape (rows x cols):", data.shape)
print("Min elevation:", np.min(data))
print("Max elevation:", np.max(data))

#show table
print("Sample of elevation data (top-left 10x10):")
print(data[:10, :10])

#show img
plt.figure(figsize=(8, 6))
plt.imshow(data, cmap='terrain')  
plt.colorbar(label='Elevation')
plt.title("GeoTIFF Topography Preview")
plt.show()
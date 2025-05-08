// src/utils/placeUtils.js
export const formatPlaceLabel = (place) => {
    if (!place || !place.geometry) return "Unnamed location";
  
    const name = place.name || "";
    const components = place.address_components || [];
  
    const getComponent = (type) =>
      components.find((c) => c.types.includes(type))?.long_name || "";
  
    const streetNumber = getComponent("street_number");
    const route = getComponent("route");
    const suburb = getComponent("sublocality") || getComponent("sublocality_level_1");
    const locality = getComponent("locality");
    const adminArea = getComponent("administrative_area_level_1");
    const country = getComponent("country");
  
    const streetAddress = [streetNumber, route].filter(Boolean).join(" ");
    const fullAddress = [streetAddress, suburb, locality, adminArea, country]
      .filter(Boolean)
      .join(", ");
  
    return name && !fullAddress.includes(name)
      ? `${name}, ${fullAddress}`
      : fullAddress || name || "Unnamed location";
  };
  
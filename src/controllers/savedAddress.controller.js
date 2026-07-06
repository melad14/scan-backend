const SavedAddress = require('../models/SavedAddress');

// GET /api/v1/addresses/saved
exports.listSavedAddresses = async (req, res, next) => {
  try {
    const addresses = await SavedAddress.find({ userId: req.user.id })
      .sort({ isDefault: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      message: 'تم استرجاع قائمة العناوين المحفوظة بنجاح',
      data: addresses
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/addresses/saved
exports.createSavedAddress = async (req, res, next) => {
  try {
    const {
      label, icon, governorate, district, street, building,
      houseNumber, road, neighbourhood, suburb, city, postcode,
      country, countryCode, floor, hasElevator, coordinates
    } = req.body;

    if (!label || !district || !street) {
      return res.status(400).json({
        success: false,
        message: 'الحقول الأساسية مطلوبة (تسمية العنوان، الحي، الشارع)',
        code: 'VALIDATION_ERROR',
        statusCode: 400
      });
    }

    const count = await SavedAddress.countDocuments({ userId: req.user.id });
    if (count >= 5) {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن إضافة أكثر من 5 عناوين محفوظة',
        code: 'LIMIT_EXCEEDED',
        statusCode: 400
      });
    }

    const isFirst = count === 0;
    const makeDefault = isFirst || req.body.isDefault === true;

    if (makeDefault) {
      await SavedAddress.updateMany({ userId: req.user.id }, { isDefault: false });
    }

    // Format coordinates if passed as [lng, lat]
    let geoJsonCoords = undefined;
    if (coordinates && Array.isArray(coordinates) && coordinates.length === 2) {
      geoJsonCoords = {
        type: 'Point',
        coordinates: [parseFloat(coordinates[0]), parseFloat(coordinates[1])] // [lng, lat]
      };
    }

    const address = await SavedAddress.create({
      userId: req.user.id,
      label,
      icon: icon || 'home',
      governorate: governorate || '',
      district,
      street,
      building: building || '',
      houseNumber: houseNumber || '',
      road: road || '',
      neighbourhood: neighbourhood || '',
      suburb: suburb || '',
      city: city || '',
      postcode: postcode || '',
      country: country || 'مصر',
      countryCode: countryCode || 'eg',
      floor: floor !== undefined ? parseInt(floor, 10) : null,
      hasElevator: hasElevator || false,
      coordinates: geoJsonCoords,
      isDefault: makeDefault
    });

    res.status(201).json({
      success: true,
      message: 'تم إضافة العنوان للملف المحفوظ بنجاح',
      data: address
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/addresses/saved/:id
exports.updateSavedAddress = async (req, res, next) => {
  try {
    const {
      label, icon, governorate, district, street, building,
      houseNumber, road, neighbourhood, suburb, city, postcode,
      country, countryCode, floor, hasElevator, coordinates, isDefault
    } = req.body;

    const address = await SavedAddress.findOne({ _id: req.params.id, userId: req.user.id });
    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على العنوان المطلوب',
        code: 'NOT_FOUND',
        statusCode: 404
      });
    }

    // Update fields if provided
    if (label !== undefined) address.label = label;
    if (icon !== undefined) address.icon = icon;
    if (governorate !== undefined) address.governorate = governorate;
    if (district !== undefined) address.district = district;
    if (street !== undefined) address.street = street;
    if (building !== undefined) address.building = building;
    if (houseNumber !== undefined) address.houseNumber = houseNumber;
    if (road !== undefined) address.road = road;
    if (neighbourhood !== undefined) address.neighbourhood = neighbourhood;
    if (suburb !== undefined) address.suburb = suburb;
    if (city !== undefined) address.city = city;
    if (postcode !== undefined) address.postcode = postcode;
    if (country !== undefined) address.country = country;
    if (countryCode !== undefined) address.countryCode = countryCode;
    if (floor !== undefined) address.floor = floor !== null ? parseInt(floor, 10) : null;
    if (hasElevator !== undefined) address.hasElevator = hasElevator;

    if (coordinates && Array.isArray(coordinates) && coordinates.length === 2) {
      address.coordinates = {
        type: 'Point',
        coordinates: [parseFloat(coordinates[0]), parseFloat(coordinates[1])]
      };
    }

    if (isDefault === true && !address.isDefault) {
      await SavedAddress.updateMany({ userId: req.user.id }, { isDefault: false });
      address.isDefault = true;
    }

    await address.save();

    res.status(200).json({
      success: true,
      message: 'تم تحديث العنوان بنجاح',
      data: address
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/addresses/saved/:id
exports.deleteSavedAddress = async (req, res, next) => {
  try {
    const address = await SavedAddress.findOne({ _id: req.params.id, userId: req.user.id });
    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على العنوان المطلوب',
        code: 'NOT_FOUND',
        statusCode: 404
      });
    }

    await SavedAddress.deleteOne({ _id: req.params.id });

    // If deleted the default address, set another address as default if exists
    if (address.isDefault) {
      const another = await SavedAddress.findOne({ userId: req.user.id });
      if (another) {
        another.isDefault = true;
        await another.save();
      }
    }

    res.status(200).json({
      success: true,
      message: 'تم حذف العنوان بنجاح'
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/addresses/saved/:id/default
exports.setDefaultAddress = async (req, res, next) => {
  try {
    const address = await SavedAddress.findOne({ _id: req.params.id, userId: req.user.id });
    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على العنوان المطلوب',
        code: 'NOT_FOUND',
        statusCode: 404
      });
    }

    await SavedAddress.updateMany({ userId: req.user.id }, { isDefault: false });
    
    address.isDefault = true;
    await address.save();

    res.status(200).json({
      success: true,
      message: 'تم تعيين العنوان كافتراضي بنجاح',
      data: address
    });
  } catch (error) {
    next(error);
  }
};

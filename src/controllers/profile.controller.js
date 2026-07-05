const User = require('../models/User');
const Technician = require('../models/Technician');

// ────────────────────────────────────────────────────────────────────────────
// GET /api/v1/profile — Fetch authenticated user's profile
// ────────────────────────────────────────────────────────────────────────────
exports.getProfile = async (req, res, next) => {
  try {
    const { id, role } = req.user;

    if (role === 'patient') {
      const user = await User.findById(id).select('-passwordHash -fcmToken -__v');
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'لم يتم العثور على المستخدم',
          code: 'NOT_FOUND',
          statusCode: 404
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          id: user._id,
          name: user.name,
          username: user.username,
          email: user.email,
          phone: user.phone,
          age: user.age,
          gender: user.gender,
          isVerified: user.isVerified,
          createdAt: user.createdAt
        }
      });
    }

    if (role === 'technician') {
      const tech = await Technician.findById(id).select('-passwordHash -fcmToken -__v');
      if (!tech) {
        return res.status(404).json({
          success: false,
          message: 'لم يتم العثور على الفني',
          code: 'NOT_FOUND',
          statusCode: 404
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          id: tech._id,
          name: tech.name,
          phone: tech.phone,
          nationalId: tech.nationalId,
          photo: tech.photo,
          rating: tech.rating,
          totalRatings: tech.totalRatings,
          completedOrders: tech.completedOrders,
          isAvailable: tech.isAvailable,
          region: tech.region,
          createdAt: tech.createdAt
        }
      });
    }

    return res.status(403).json({
      success: false,
      message: 'صلاحية غير معروفة',
      code: 'AUTH_005',
      statusCode: 403
    });
  } catch (error) {
    next(error);
  }
};

// ────────────────────────────────────────────────────────────────────────────
// PUT /api/v1/profile — Update allowed profile fields
// ────────────────────────────────────────────────────────────────────────────
exports.updateProfile = async (req, res, next) => {
  try {
    const { id, role } = req.user;

    if (role === 'patient') {
      // Whitelist: only these fields can be updated by the patient
      const allowedFields = ['name', 'phone', 'age', 'gender'];
      const updates = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'لم يتم توفير أي بيانات للتحديث',
          code: 'VALIDATION_ERROR',
          statusCode: 400
        });
      }

      // Validate gender if provided
      if (updates.gender && !['male', 'female'].includes(updates.gender)) {
        return res.status(400).json({
          success: false,
          message: 'الجنس يجب أن يكون male أو female',
          code: 'VALIDATION_ERROR',
          statusCode: 400
        });
      }

      const user = await User.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true })
        .select('-passwordHash -fcmToken -__v');

      return res.status(200).json({
        success: true,
        message: 'تم تحديث البيانات بنجاح',
        data: {
          id: user._id,
          name: user.name,
          username: user.username,
          email: user.email,
          phone: user.phone,
          age: user.age,
          gender: user.gender,
          isVerified: user.isVerified,
          createdAt: user.createdAt
        }
      });
    }

    if (role === 'technician') {
      // Technicians can only update their name (phone, nationalId, region are admin-managed)
      const allowedFields = ['name'];
      const updates = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'لم يتم توفير أي بيانات للتحديث',
          code: 'VALIDATION_ERROR',
          statusCode: 400
        });
      }

      const tech = await Technician.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true })
        .select('-passwordHash -fcmToken -__v');

      return res.status(200).json({
        success: true,
        message: 'تم تحديث البيانات بنجاح',
        data: {
          id: tech._id,
          name: tech.name,
          phone: tech.phone,
          nationalId: tech.nationalId,
          photo: tech.photo,
          rating: tech.rating,
          totalRatings: tech.totalRatings,
          completedOrders: tech.completedOrders,
          isAvailable: tech.isAvailable,
          region: tech.region,
          createdAt: tech.createdAt
        }
      });
    }

    return res.status(403).json({
      success: false,
      message: 'صلاحية غير معروفة',
      code: 'AUTH_005',
      statusCode: 403
    });
  } catch (error) {
    next(error);
  }
};

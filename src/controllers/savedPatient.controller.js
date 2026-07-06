const SavedPatient = require('../models/SavedPatient');
const User = require('../models/User');

// GET /api/v1/patients/saved
exports.listSavedPatients = async (req, res, next) => {
  try {
    let patients = await SavedPatient.find({ userId: req.user.id })
      .sort({ isDefault: -1, createdAt: -1 });

    // Fallback logic: if empty, auto-create default 'self' patient from user record
    if (patients.length === 0) {
      const user = await User.findById(req.user.id);
      if (user) {
        const selfPatient = await SavedPatient.create({
          userId: req.user.id,
          label: 'أنا',
          name: user.name,
          phone: user.phone || '',
          age: user.age || 0,
          gender: user.gender || 'male',
          relationship: 'self',
          isDefault: true
        });
        patients = [selfPatient];
      }
    }

    res.status(200).json({
      success: true,
      message: 'تم استرجاع قائمة المرضى بنجاح',
      data: patients
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/patients/saved
exports.createSavedPatient = async (req, res, next) => {
  try {
    const { label, name, phone, age, gender, relationship, caseDefaults } = req.body;

    if (!label || !name || !phone || !age || !gender) {
      return res.status(400).json({
        success: false,
        message: 'الحقول الأساسية مطلوبة (العلاقة، الاسم، الهاتف، العمر، الجنس)',
        code: 'VALIDATION_ERROR',
        statusCode: 400
      });
    }

    const count = await SavedPatient.countDocuments({ userId: req.user.id });
    if (count >= 10) {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن إضافة أكثر من 10 مرضى محفوظين',
        code: 'LIMIT_EXCEEDED',
        statusCode: 400
      });
    }

    // Set default logic
    const isFirst = count === 0;
    const makeDefault = isFirst || req.body.isDefault === true;

    if (makeDefault) {
      // Clear previous defaults
      await SavedPatient.updateMany({ userId: req.user.id }, { isDefault: false });
    }

    const patient = await SavedPatient.create({
      userId: req.user.id,
      label,
      name,
      phone,
      age: parseInt(age, 10),
      gender,
      relationship: relationship || 'other',
      caseDefaults: caseDefaults || {},
      isDefault: makeDefault
    });

    res.status(201).json({
      success: true,
      message: 'تم إضافة المريض للملف المحفوظ بنجاح',
      data: patient
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/patients/saved/:id
exports.updateSavedPatient = async (req, res, next) => {
  try {
    const { label, name, phone, age, gender, relationship, caseDefaults, isDefault } = req.body;
    
    const patient = await SavedPatient.findOne({ _id: req.params.id, userId: req.user.id });
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على المريض المطلوب',
        code: 'NOT_FOUND',
        statusCode: 404
      });
    }

    // Update fields
    if (label !== undefined) patient.label = label;
    if (name !== undefined) patient.name = name;
    if (phone !== undefined) patient.phone = phone;
    if (age !== undefined) patient.age = parseInt(age, 10);
    if (gender !== undefined) patient.gender = gender;
    if (relationship !== undefined) patient.relationship = relationship;
    if (caseDefaults !== undefined) patient.caseDefaults = caseDefaults;

    if (isDefault === true && !patient.isDefault) {
      await SavedPatient.updateMany({ userId: req.user.id }, { isDefault: false });
      patient.isDefault = true;
    }

    await patient.save();

    res.status(200).json({
      success: true,
      message: 'تم تحديث بيانات المريض بنجاح',
      data: patient
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/patients/saved/:id
exports.deleteSavedPatient = async (req, res, next) => {
  try {
    const patient = await SavedPatient.findOne({ _id: req.params.id, userId: req.user.id });
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على المريض المطلوب',
        code: 'NOT_FOUND',
        statusCode: 404
      });
    }

    if (patient.relationship === 'self' || patient.isDefault) {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن حذف الحساب الأساسي للمستخدم أو المريض الافتراضي',
        code: 'DELETE_DENIED',
        statusCode: 400
      });
    }

    await SavedPatient.deleteOne({ _id: req.params.id });

    res.status(200).json({
      success: true,
      message: 'تم حذف المريض من القائمة بنجاح'
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/patients/saved/:id/default
exports.setDefaultPatient = async (req, res, next) => {
  try {
    const patient = await SavedPatient.findOne({ _id: req.params.id, userId: req.user.id });
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على المريض المطلوب',
        code: 'NOT_FOUND',
        statusCode: 404
      });
    }

    await SavedPatient.updateMany({ userId: req.user.id }, { isDefault: false });
    
    patient.isDefault = true;
    await patient.save();

    res.status(200).json({
      success: true,
      message: 'تم تعيين المريض كافتراضي بنجاح',
      data: patient
    });
  } catch (error) {
    next(error);
  }
};

const uploadService = require('../services/upload.service');

// 1. Upload Patient Prescription (max 20MB)
exports.uploadPrescription = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إرفاق ملف الروشتة',
        code: 'VALIDATION_ERROR',
        statusCode: 400
      });
    }

    // Limit prescription files to 20MB
    if (file.size > 20 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: 'حجم ملف الروشتة لا يجب أن يتجاوز 20 ميجابايت',
        code: 'UPLOAD_002',
        statusCode: 400
      });
    }

    const fileUrl = await uploadService.uploadFile(file, 'prescriptions');

    res.status(200).json({
      success: true,
      message: 'تم رفع الروشتة بنجاح',
      data: {
        url: fileUrl
      }
    });
  } catch (error) {
    next(error);
  }
};

// 2. Upload X-Ray Report Images (max 50MB total)
exports.uploadReportImages = async (req, res, next) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إرفاق صور التقرير والأشعة',
        code: 'VALIDATION_ERROR',
        statusCode: 400
      });
    }

    // Check aggregate size limit (50MB total)
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > 50 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: 'حجم الصور الإجمالي لا يجب أن يتجاوز 50 ميجابايت',
        code: 'UPLOAD_002',
        statusCode: 400
      });
    }

    const uploadPromises = files.map(file => uploadService.uploadFile(file, 'reports'));
    const fileUrls = await Promise.all(uploadPromises);

    res.status(200).json({
      success: true,
      message: 'تم رفع صور الأشعة بنجاح',
      data: {
        urls: fileUrls
      }
    });
  } catch (error) {
    next(error);
  }
};

// 3. Upload Report PDF (max 20MB)
exports.uploadReportPdf = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إرفاق التقرير الطبي بصيغة PDF',
        code: 'VALIDATION_ERROR',
        statusCode: 400
      });
    }

    // Limit report PDF files to 20MB
    if (file.size > 20 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: 'حجم ملف التقرير PDF لا يجب أن يتجاوز 20 ميجابايت',
        code: 'UPLOAD_002',
        statusCode: 400
      });
    }

    const fileUrl = await uploadService.uploadFile(file, 'reports');

    res.status(200).json({
      success: true,
      message: 'تم رفع تقرير الـ PDF بنجاح',
      data: {
        url: fileUrl
      }
    });
  } catch (error) {
    next(error);
  }
};

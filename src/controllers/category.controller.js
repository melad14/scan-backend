const Category = require('../models/Category');

// GET /api/v1/categories
exports.listCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ sortOrder: 1 });
    
    res.status(200).json({
      success: true,
      message: 'تم استرجاع قائمة التصنيفات بنجاح',
      data: categories
    });
  } catch (error) {
    next(error);
  }
};

const Product = require("../../models/product/productModel");
const ProductVariation = require("../../models/product/productVariationModel");
const DealProduct = require("../../models/product/dealProductModel");
const MasterUser = require("../../models/master/masterUserModel");
const { Op } = require("sequelize");
const GroupVisibility = require("../../models/admin/groupVisibilityModel");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { ProductColumn } = require("../../models");

// Configure multer for product image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../uploads/products");
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-originalname
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed."
        )
      );
    }
  },
});

// Export the upload middleware for use in routes - make it optional
exports.uploadProductImage = (req, res, next) => {
  // Check if request has multipart/form-data content type
  const contentType = req.get("content-type") || "";

  if (!contentType.includes("multipart/form-data")) {
    // Skip file upload for non-multipart requests (JSON requests)
    console.log("Skipping file upload - not multipart/form-data");
    return next();
  }

  // Use multer for multipart requests
  const uploadSingle = upload.single("productImage");

  uploadSingle(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        // Field name mismatch - continue without file
        console.log(
          "No productImage field found, continuing without file upload"
        );
        return next();
      }
      return res.status(400).json({
        status: "error",
        message: `File upload error: ${err.message}`,
        code: err.code,
      });
    } else if (err) {
      return res.status(400).json({
        status: "error",
        message: err.message,
      });
    }
    next();
  });
};

// Create a new product
exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      code,
      description,
      category,
      unit,
      prices,
      cost,
      costCurrency,
      billingFrequency,
      billingFrequencyCustom,
      taxType,
      taxPercentage,
      discountType,
      discountValue,
      hasVariations,
      visibilityGroup,
      metadata,
      variations, // Array of variation objects
    } = req.body;

    const ownerId = req.adminId;

    // Handle image upload
    let imageUrl = req.body.imageUrl || null;
    if (req.file) {
      // Generate URL for the uploaded image
      const baseURL =
        process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
      imageUrl = `${baseURL}/uploads/products/${req.file.filename}`;
      console.log("Product image uploaded:", imageUrl);
    }

    // Create product
    const product = await Product.create({
      name,
      code,
      description,
      category,
      unit,
      prices,
      cost,
      costCurrency: costCurrency || "INR",
      billingFrequency: billingFrequency || "one-time",
      billingFrequencyCustom,
      taxType: taxType || "tax-exclusive",
      taxPercentage: taxPercentage || 0,
      discountType,
      discountValue,
      hasVariations: hasVariations || false,
      isActive: true,
      visibilityGroup,
      ownerId,
      companyId: req.companyId || null,
      imageUrl,
      metadata,
    });

    // Create variations if provided
    if (hasVariations && variations && variations.length > 0) {
      const variationData = variations.map((v, index) => ({
        productId: product.productId,
        name: v.name,
        sku: v.sku,
        description: v.description,
        prices: v.prices,
        cost: v.cost,
        attributes: v.attributes,
        sortOrder: v.sortOrder || index,
        isActive: v.isActive !== undefined ? v.isActive : true,
      }));
      await ProductVariation.bulkCreate(variationData);
    }

    // Fetch complete product with variations
    const createdProduct = await Product.findByPk(product.productId, {
      include: [
        {
          model: ProductVariation,
          as: "variations",
          where: { isActive: true },
          required: false,
        },
        {
          model: MasterUser,
          as: "owner",
          attributes: ["masterUserID", "name", "email"],
        },
      ],
    });

    res.status(201).json({
      status: "success",
      message: "Product created successfully",
      data: createdProduct,
    });
  } catch (error) {
    console.error("Error creating product:", error);

    // Clean up uploaded file if product creation failed
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
        console.log("Cleaned up uploaded file after error");
      } catch (unlinkError) {
        console.error("Error cleaning up file:", unlinkError);
      }
    }

    res.status(500).json({
      status: "error",
      message: "Failed to create product",
      error: error.message,
    });
  }
};

// Get all products with filtering and pagination
exports.getProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      isActive,
      sortBy = "createdAt",
      sortOrder = "DESC",
      groupId,
    } = req.query;

    const offset = (page - 1) * limit;

    const pref = await ProductColumn.findOne();
    let attributes = [];

    if (pref) {
      const columns =
        typeof pref.columns === "string"
          ? JSON.parse(pref.columns)
          : pref.columns;

      const activityFields = Object.keys(Product.rawAttributes);
      const dealFields = Object.keys(Product.rawAttributes);

      // Filter Activity columns that are checked
      columns
        .filter(
          (col) =>
            col.check &&
            col.entityType === "Activity" &&
            activityFields.includes(col.key)
        )
        .forEach((col) => {
          attributes.push(col.key);
        });

     

      if (attributes.length === 0) attributes = undefined;
    }

    // Build where clause
    const where = {};

    // Multi-tenancy filter (optional - if you implement companyId in JWT)
    if (req.companyId) {
      where.companyId = req.companyId;
    }

    // Search filter
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { code: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    // Category filter
    if (category) {
      where.category = category;
    }

    // Active status filter
    if (isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    const { count, rows: products } = await Product.findAndCountAll({
      where,
      include: [
        {
          model: ProductVariation,
          as: "variations",
          where: { isActive: true },
          required: false,
        },
        {
          model: MasterUser,
          as: "owner",
          attributes: ["masterUserID", "name", "email"],
        },
      ],
      attributes: attributes,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, sortOrder.toUpperCase()]],
    });

    if(groupId){
      const findGroup = await GroupVisibility.findOne({
        where: {
          groupId: groupId,
        },
      });
  
      let filterProducts = [];
  
      if (findGroup?.lead?.toLowerCase() == "visibilitygroup") {
        let findParentGroup = null;
        if (findGroup?.parentGroupId) {
          findParentGroup = await GroupVisibility.findOne({
            where: {
              groupId: findGroup?.parentGroupId,
            },
          });
        }
  
        const Filter = products.filter(
          (idx) =>
            idx?.ownerId == req.adminId ||
            idx?.visibilityGroupId == groupId ||
            idx?.visibilityGroup == findGroup?.parentGroupId ||
            findParentGroup.memberIds?.split(",").includes(req.adminId.toString())
        );
        filterProducts = Filter;
      } else if (findGroup?.lead?.toLowerCase() == "owner") {
        let findParentGroup = null;
        if (findGroup?.parentGroupId) {
          findParentGroup = await GroupVisibility.findOne({
            where: {
              groupId: findGroup?.parentGroupId,
            },
          });
        }
  
        const Filter = products.filter(
          (idx) =>
            idx?.ownerId == req.adminId ||
            idx?.visibilityGroup == findGroup?.parentGroupId ||
            findParentGroup.memberIds?.split(",").includes(req.adminId.toString())
        );
  
        filterProducts = Filter;
      } else {
        filterProducts = products;
      }
    }
    res.status(200).json({
      status: "success",
      data: {
        products: groupId ? filterProducts : products,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch products",
      error: error.message,
    });
  }
};

// Get single product by ID
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id, {
      include: [
        {
          model: ProductVariation,
          as: "variations",
          where: { isActive: true },
          required: false,
        },
        {
          model: MasterUser,
          as: "owner",
          attributes: ["masterUserID", "name", "email"],
        },
      ],
    });

    if (!product) {
      return res.status(404).json({
        status: "error",
        message: "Product not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: product,
    });
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch product",
      error: error.message,
    });
  }
};

// Update product
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const product = await Product.findByPk(id);

    if (!product) {
      return res.status(404).json({
        status: "error",
        message: "Product not found",
      });
    }

    // Handle image upload
    if (req.file) {
      // Generate URL for the uploaded image
      const baseURL =
        process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
      updateData.imageUrl = `${baseURL}/uploads/products/${req.file.filename}`;
      console.log("Product image updated:", updateData.imageUrl);

      // Delete old image file if exists
      if (product.imageUrl) {
        try {
          const oldImagePath = product.imageUrl.replace(
            `${baseURL}/uploads/products/`,
            ""
          );
          const fullPath = path.join(
            __dirname,
            "../../uploads/products",
            oldImagePath
          );
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            console.log("Old product image deleted:", oldImagePath);
          }
        } catch (deleteError) {
          console.error("Error deleting old image:", deleteError);
          // Continue with update even if old image deletion fails
        }
      }
    }

    // Update product
    await product.update(updateData);

    // Handle variations if provided
    if (updateData.variations) {
      // Delete existing variations if needed and create new ones
      // Or implement update logic for individual variations
      for (const variation of updateData.variations) {
        if (variation.variationId) {
          // Update existing variation
          await ProductVariation.update(variation, {
            where: { variationId: variation.variationId, productId: id },
          });
        } else {
          // Create new variation
          await ProductVariation.create({
            ...variation,
            productId: id,
          });
        }
      }
    }

    // Fetch updated product
    const updatedProduct = await Product.findByPk(id, {
      include: [
        {
          model: ProductVariation,
          as: "variations",
          where: { isActive: true },
          required: false,
        },
        {
          model: MasterUser,
          as: "owner",
          attributes: ["masterUserID", "name", "email"],
        },
      ],
    });

    res.status(200).json({
      status: "success",
      message: "Product updated successfully",
      data: updatedProduct,
    });
  } catch (error) {
    console.error("Error updating product:", error);

    // Clean up uploaded file if product update failed
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
        console.log("Cleaned up uploaded file after error");
      } catch (unlinkError) {
        console.error("Error cleaning up file:", unlinkError);
      }
    }

    res.status(500).json({
      status: "error",
      message: "Failed to update product",
      error: error.message,
    });
  }
};

// Delete product (soft delete)
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id);

    if (!product) {
      return res.status(404).json({
        status: "error",
        message: "Product not found",
      });
    }

    // Soft delete by setting isActive to false
    await product.update({ isActive: false });

    res.status(200).json({
      status: "success",
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to delete product",
      error: error.message,
    });
  }
};

// Get product categories (unique list)
exports.getCategories = async (req, res) => {
  try {
    const categories = await Product.findAll({
      attributes: ["category"],
      where: {
        category: { [Op.ne]: null },
        isActive: true,
      },
      group: ["category"],
      raw: true,
    });

    const categoryList = categories.map((c) => c.category);

    res.status(200).json({
      status: "success",
      data: categoryList,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch categories",
      error: error.message,
    });
  }
};

// Add product to deal
exports.addProductToDeal = async (req, res) => {
  try {
    console.log("🔵 [ADD PRODUCT TO DEAL] Request received");
    console.log("🔵 Request body:", JSON.stringify(req.body, null, 2));

    const {
      dealId,
      productId,
      variationId,
      quantity,
      unitPrice,
      currency,
      discountType,
      discountValue,
      taxType,
      taxPercentage,
      billingFrequency,
      billingStartDate,
      billingEndDate,
      notes,
    } = req.body;

    console.log("🔵 Parsed values:", {
      dealId,
      productId,
      quantity,
      unitPrice,
    });

    // Validate required fields
    if (!dealId || !productId || !quantity || !unitPrice) {
      console.log("❌ Missing required fields");
      return res.status(400).json({
        status: "error",
        message:
          "Missing required fields: dealId, productId, quantity, unitPrice",
      });
    }

    // Calculate amounts
    const subtotal = parseFloat(quantity) * parseFloat(unitPrice);
    let discountAmount = 0;

    if (discountType === "percentage") {
      discountAmount = (subtotal * parseFloat(discountValue)) / 100;
    } else if (discountType === "fixed") {
      discountAmount = parseFloat(discountValue);
    }

    const amountAfterDiscount = subtotal - discountAmount;
    let taxAmount = 0;
    let total = amountAfterDiscount;

    if (taxType === "tax-exclusive") {
      taxAmount = (amountAfterDiscount * parseFloat(taxPercentage || 0)) / 100;
      total = amountAfterDiscount + taxAmount;
    } else if (taxType === "tax-inclusive") {
      taxAmount =
        (amountAfterDiscount * parseFloat(taxPercentage || 0)) /
        (100 + parseFloat(taxPercentage || 0));
      total = amountAfterDiscount;
    }

    console.log("🔵 Creating deal product with:", {
      dealId,
      productId,
      quantity,
      unitPrice,
      subtotal,
      total,
    });

    const dealProduct = await DealProduct.create({
      dealId,
      productId,
      variationId,
      quantity,
      unitPrice,
      currency: currency || "INR",
      discountType,
      discountValue,
      discountAmount,
      taxType: taxType || "tax-exclusive",
      taxPercentage: taxPercentage || 0,
      taxAmount,
      subtotal,
      total,
      billingFrequency,
      billingStartDate,
      billingEndDate,
      notes,
    });

    console.log("✅ Deal product created with ID:", dealProduct.dealProductId);

    // Fetch complete deal product with associations
    const createdDealProduct = await DealProduct.findByPk(
      dealProduct.dealProductId,
      {
        include: [
          {
            model: Product,
            as: "product",
          },
          {
            model: ProductVariation,
            as: "variation",
          },
        ],
      }
    );

    console.log("✅ Returning created deal product");

    res.status(201).json({
      status: "success",
      message: "Product added to deal successfully",
      data: createdDealProduct,
    });
  } catch (error) {
    console.error("❌ Error adding product to deal:", error);
    console.error("❌ Error stack:", error.stack);
    res.status(500).json({
      status: "error",
      message: "Failed to add product to deal",
      error: error.message,
    });
  }
};

// Get products for a deal
exports.getDealProducts = async (req, res) => {
  try {
    const { dealId } = req.params;

    const dealProducts = await DealProduct.findAll({
      where: { dealId },
      include: [
        {
          model: Product,
          as: "product",
        },
        {
          model: ProductVariation,
          as: "variation",
        },
      ],
      order: [
        ["sortOrder", "ASC"],
        ["createdAt", "ASC"],
      ],
    });

    // Calculate totals and revenue metrics
    const calculations = dealProducts.reduce(
      (acc, dp) => {
        const subtotal = parseFloat(dp.subtotal || 0);
        const discount = parseFloat(dp.discountAmount || 0);
        const tax = parseFloat(dp.taxAmount || 0);
        const total = parseFloat(dp.total || 0);

        acc.totalSubtotal += subtotal;
        acc.totalDiscount += discount;
        acc.totalTax += tax;
        acc.grandTotal += total;

        // Calculate revenue metrics based on billing frequency
        const billingFrequency = dp.billingFrequency;

        if (billingFrequency === "monthly") {
          acc.monthlyRecurringRevenue += total;
          acc.annualRecurringRevenue += total * 12;
        } else if (billingFrequency === "quarterly") {
          acc.monthlyRecurringRevenue += total / 3;
          acc.annualRecurringRevenue += total * 4;
        } else if (billingFrequency === "semi-annually") {
          acc.monthlyRecurringRevenue += total / 6;
          acc.annualRecurringRevenue += total * 2;
        } else if (billingFrequency === "annually") {
          acc.monthlyRecurringRevenue += total / 12;
          acc.annualRecurringRevenue += total;
        } else {
          // one-time
          acc.oneTimeRevenue += total;
        }

        // Calculate contract value (if has billing dates)
        if (dp.billingStartDate && dp.billingEndDate) {
          const startDate = new Date(dp.billingStartDate);
          const endDate = new Date(dp.billingEndDate);
          const monthsDiff =
            (endDate.getFullYear() - startDate.getFullYear()) * 12 +
            (endDate.getMonth() - startDate.getMonth());

          if (billingFrequency === "monthly" && monthsDiff > 0) {
            acc.totalContractValue += total * monthsDiff;
          } else if (billingFrequency === "quarterly" && monthsDiff > 0) {
            acc.totalContractValue += total * Math.ceil(monthsDiff / 3);
          } else if (billingFrequency === "annually" && monthsDiff > 0) {
            acc.totalContractValue += total * Math.ceil(monthsDiff / 12);
          }
        }

        return acc;
      },
      {
        totalSubtotal: 0,
        totalDiscount: 0,
        totalTax: 0,
        grandTotal: 0,
        monthlyRecurringRevenue: 0, // MRR
        annualRecurringRevenue: 0, // ARR
        oneTimeRevenue: 0,
        totalContractValue: 0, // TCV
      }
    );

    // Annual Contract Value (ACV) = ARR + One-time revenue
    calculations.annualContractValue =
      calculations.annualRecurringRevenue + calculations.oneTimeRevenue;

    // Format summary for frontend
    const summary = {
      subtotalExcludingTax: calculations.totalSubtotal.toFixed(2),
      totalDiscount: calculations.totalDiscount.toFixed(2),
      totalTax: calculations.totalTax.toFixed(2),
      totalWithTax: calculations.grandTotal.toFixed(2),
    };

    const revenue = {
      monthlyRecurringRevenue: calculations.monthlyRecurringRevenue.toFixed(2),
      annualRecurringRevenue: calculations.annualRecurringRevenue.toFixed(2),
      annualContractValue: calculations.annualContractValue.toFixed(2),
      totalContractValue: calculations.totalContractValue.toFixed(2),
      oneTimeRevenue: calculations.oneTimeRevenue.toFixed(2),
    };

    res.status(200).json({
      status: "success",
      data: {
        products: dealProducts,
        summary,
        revenue,
      },
    });
  } catch (error) {
    console.error("Error fetching deal products:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch deal products",
      error: error.message,
    });
  }
};

// Update deal product
exports.updateDealProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const dealProduct = await DealProduct.findByPk(id);

    if (!dealProduct) {
      return res.status(404).json({
        status: "error",
        message: "Deal product not found",
      });
    }

    // Recalculate if quantity or price changed
    if (updateData.quantity || updateData.unitPrice) {
      const quantity = updateData.quantity || dealProduct.quantity;
      const unitPrice = updateData.unitPrice || dealProduct.unitPrice;
      const subtotal = parseFloat(quantity) * parseFloat(unitPrice);

      updateData.subtotal = subtotal;

      // Recalculate discount
      let discountAmount = 0;
      const discountType = updateData.discountType || dealProduct.discountType;
      const discountValue =
        updateData.discountValue || dealProduct.discountValue;

      if (discountType === "percentage") {
        discountAmount = (subtotal * parseFloat(discountValue)) / 100;
      } else if (discountType === "fixed") {
        discountAmount = parseFloat(discountValue);
      }

      updateData.discountAmount = discountAmount;

      // Recalculate tax
      const amountAfterDiscount = subtotal - discountAmount;
      const taxType = updateData.taxType || dealProduct.taxType;
      const taxPercentage =
        updateData.taxPercentage || dealProduct.taxPercentage;
      let taxAmount = 0;
      let total = amountAfterDiscount;

      if (taxType === "tax-exclusive") {
        taxAmount =
          (amountAfterDiscount * parseFloat(taxPercentage || 0)) / 100;
        total = amountAfterDiscount + taxAmount;
      } else if (taxType === "tax-inclusive") {
        taxAmount =
          (amountAfterDiscount * parseFloat(taxPercentage || 0)) /
          (100 + parseFloat(taxPercentage || 0));
        total = amountAfterDiscount;
      }

      updateData.taxAmount = taxAmount;
      updateData.total = total;
    }

    await dealProduct.update(updateData);

    // Fetch updated deal product
    const updatedDealProduct = await DealProduct.findByPk(id, {
      include: [
        {
          model: Product,
          as: "product",
        },
        {
          model: ProductVariation,
          as: "variation",
        },
      ],
    });

    res.status(200).json({
      status: "success",
      message: "Deal product updated successfully",
      data: updatedDealProduct,
    });
  } catch (error) {
    console.error("Error updating deal product:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to update deal product",
      error: error.message,
    });
  }
};

// Remove product from deal
exports.removeDealProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const dealProduct = await DealProduct.findByPk(id);

    if (!dealProduct) {
      return res.status(404).json({
        status: "error",
        message: "Deal product not found",
      });
    }

    await dealProduct.destroy();

    res.status(200).json({
      status: "success",
      message: "Product removed from deal successfully",
    });
  } catch (error) {
    console.error("Error removing deal product:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to remove deal product",
      error: error.message,
    });
  }
};

// Update deal-level tax settings (applies to all products in deal)
exports.updateDealTaxSettings = async (req, res) => {
  try {
    const { dealId } = req.params;
    const { taxType, taxPercentage } = req.body;

    // Update all products in this deal with new tax settings
    const dealProducts = await DealProduct.findAll({ where: { dealId } });

    for (const dp of dealProducts) {
      const subtotal = parseFloat(dp.subtotal || 0);
      const discountAmount = parseFloat(dp.discountAmount || 0);
      const amountAfterDiscount = subtotal - discountAmount;

      let taxAmount = 0;
      let total = amountAfterDiscount;

      if (taxType === "tax-exclusive") {
        taxAmount =
          (amountAfterDiscount * parseFloat(taxPercentage || 0)) / 100;
        total = amountAfterDiscount + taxAmount;
      } else if (taxType === "tax-inclusive") {
        taxAmount =
          (amountAfterDiscount * parseFloat(taxPercentage || 0)) /
          (100 + parseFloat(taxPercentage || 0));
        total = amountAfterDiscount;
      } else if (taxType === "no-tax") {
        taxAmount = 0;
        total = amountAfterDiscount;
      }

      await dp.update({
        taxType,
        taxPercentage: taxPercentage || 0,
        taxAmount,
        total,
      });
    }

    res.status(200).json({
      status: "success",
      message: "Tax settings updated for all products in deal",
    });
  } catch (error) {
    console.error("Error updating deal tax settings:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to update tax settings",
      error: error.message,
    });
  }
};

// Search products (for autocomplete in deal product form)
exports.searchProducts = async (req, res) => {
  try {
    const { query, limit = 10 } = req.query;

    if (!query || query.length < 2) {
      return res.status(200).json({
        status: "success",
        data: [],
      });
    }

    const products = await Product.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.like]: `%${query}%` } },
          { code: { [Op.like]: `%${query}%` } },
        ],
        isActive: true,
      },
      include: [
        {
          model: ProductVariation,
          as: "variations",
          where: { isActive: true },
          required: false,
        },
      ],
      limit: parseInt(limit),
      order: [["name", "ASC"]],
    });

    res.status(200).json({
      status: "success",
      data: products,
    });
  } catch (error) {
    console.error("Error searching products:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to search products",
      error: error.message,
    });
  }
};

// Delete product variation (soft delete)
exports.deleteProductVariation = async (req, res) => {
  try {
    const { variationId } = req.params;
    const ownerId = req.adminId;

    const variation = await ProductVariation.findByPk(variationId, {
      include: [
        {
          model: Product,
          as: "product",
          attributes: ["productId", "name", "ownerId"],
        },
      ],
    });

    if (!variation) {
      return res.status(404).json({
        status: "error",
        message: "Product variation not found",
      });
    }

    // Soft delete by setting isActive to false
    await variation.update({ isActive: false });

    res.status(200).json({
      status: "success",
      message: "Product variation deleted successfully",
      data: {
        variationId: variation.variationId,
        productId: variation.productId,
        name: variation.name,
      },
    });
  } catch (error) {
    console.error("Error deleting product variation:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to delete product variation",
      error: error.message,
    });
  }
};

exports.getProductsFields = async (req, res) => {
  try {
    // Fetch data from ActivityColumnPreference table
    const pref = await ProductColumn.findOne();
    
    if (!pref || !pref.columns) {
      return res.status(404).json({ 
        message: "No column preferences found",
        fields: []
      });
    }

    // Parse columns data if it's stored as JSON string
    const columns = typeof pref.columns === "string" 
      ? JSON.parse(pref.columns) 
      : pref.columns;

    // Transform the data to include labels for better display
    const fieldsWithLabels = columns.map(column => ({
      key: column.entityType === 'Deal' ? `deal_${column.key}` : column.key, // Add deal_ prefix for Deal fields
      label: column.key
        .replace(/([A-Z])/g, " $1") // Add space before capital letters
        .replace(/^./, str => str.toUpperCase()), // Capitalize first letter
      check: column.check,
      entityType: column.entityType
    }));

    res.status(200).json({ 
      success: true,
      fields: fieldsWithLabels,
      totalFields: fieldsWithLabels.length,
      activityFields: fieldsWithLabels.filter(field => field.entityType === 'Activity').length,
      dealFields: fieldsWithLabels.filter(field => field.entityType === 'Deal').length
    });
  } catch (error) {
    console.error("Error fetching activity fields:", error);
    res.status(500).json({ 
      success: false,
      message: "Error fetching activity fields",
      error: error.message 
    });
  }
};

exports.updateProductColumnChecks = async (req, res) => {
  // Expecting: { columns: [ { key: "columnName", check: true/false }, ... ] }
  const { columns } = req.body;

  if (!Array.isArray(columns)) {
    return res.status(400).json({ message: "Columns array is required." });
  }

  try {
    // Find the global ActivityColumnPreference record
    let pref = await ProductColumn.findOne();
    if (!pref) {
      return res.status(404).json({ message: "Preferences not found." });
    }

    // Parse columns if stored as string
    let prefColumns =
      typeof pref.columns === "string"
        ? JSON.parse(pref.columns)
        : pref.columns;

    // Update check status for matching columns
    prefColumns = prefColumns.map((col) => {
      const found = columns.find((c) => c.key === col.key);
      if (found) {
        return { ...col, check: !!found.check };
      }
      return col;
    });

    pref.columns = prefColumns;
    await pref.save();
    res.status(200).json({ message: "Columns updated", columns: pref.columns });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating columns" });
  }
};

module.exports = exports;

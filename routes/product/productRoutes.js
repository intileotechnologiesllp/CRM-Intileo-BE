
const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");
const validatePrivilege = require("../../middlewares/validatePrivilege");
const productController = require("../../controllers/product/productController");
const Product = require("../../models/product/productModel");

// Product CRUD routes
// Permission 29: Add products
router.post("/create", verifyToken, validatePrivilege("29", "create"), productController.uploadProductImage, productController.createProduct);

// Get products - no special permission required (users can see products they have access to)
router.get("/get", verifyToken, productController.getProducts);
router.get("/get/:id", verifyToken, productController.getProductById);

// Permission 30: Edit products owned by other users (includes ownership check)
// Permission 31: Edit the owner on a product owned by other users
router.post("/update/:id", verifyToken, validatePrivilege("30", "edit_others", { checkOwnership: true, ownershipModel: Product }), productController.uploadProductImage, productController.updateProduct);

// Permission 32: Delete products
router.post("/delete/:id", verifyToken, validatePrivilege("32", "delete"), productController.deleteProduct);

// Get product categories
router.get("/categories", verifyToken, productController.getCategories);

// Deal-Product association routes
router.post("/deal/add", verifyToken, productController.addProductToDeal);
router.get("/deal/:dealId", verifyToken, productController.getDealProducts);
router.post("/deal/update/:id", verifyToken, productController.updateDealProduct);
router.post("/deal/remove/:id", verifyToken, productController.removeDealProduct);
router.post("/deal/:dealId/tax-settings", verifyToken, productController.updateDealTaxSettings);

// Product search for autocomplete
router.get("/search", verifyToken, productController.searchProducts);

// Product Variation routes
// Permission 33: Delete product price variations
router.post("/variation/delete/:variationId", verifyToken, validatePrivilege("33", "delete_variations"), productController.deleteProductVariation);

router.get(
  "/get-products-fields",
  verifyToken,
  productController.getProductsFields
);

router.post(
  "/check-columns",
  verifyToken,
  productController.updateProductColumnChecks
);
module.exports = router;

console.log('🔍 Testing route loading...');

try {
    console.log('📂 Loading twoFactorRoutes...');
    const twoFactorRoutes = require("./routes/auth/twoFactorRoutes");
    console.log('✅ twoFactorRoutes loaded successfully');
    console.log('📋 Route type:', typeof twoFactorRoutes);
    console.log('📋 Route stack length:', twoFactorRoutes.stack?.length || 'No stack');
    
    // Check if routes are registered
    if (twoFactorRoutes.stack) {
        console.log('🛣️ Registered routes:');
        twoFactorRoutes.stack.forEach((layer, i) => {
            const path = layer.route?.path || 'middleware';
            const methods = layer.route?.methods ? Object.keys(layer.route.methods).join(',') : 'unknown';
            console.log(`   ${i + 1}. ${path} - ${methods}`);
        });
    }
    
    console.log('📂 Loading twoFactorController...');
    const twoFactorController = require("./controllers/auth/twoFactorController");
    console.log('✅ twoFactorController loaded successfully');
    console.log('📋 Controller functions:', Object.keys(twoFactorController));
    
    console.log('📂 Loading middlewares...');
    const { verifyToken } = require("./middlewares/authMiddleware");
    const { twoFactorSetupRateLimiter } = require("./middlewares/twoFactorMiddleware");
    console.log('✅ Middlewares loaded successfully');
    
} catch (error) {
    console.log('❌ Error loading routes:', error.message);
    console.log('📋 Full error:', error);
}
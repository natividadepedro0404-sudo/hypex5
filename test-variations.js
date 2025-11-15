const fetch = require('node-fetch');

async function testVariations() {
  try {
    // Test creating a product first
    const productResponse = await fetch('http://localhost:3000/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Test Product',
        description: 'Test product for variations',
        price: 100,
        stock: 10
      })
    });

    const productData = await productResponse.json();
    console.log('Product created:', productData);

    if (!productData.product || !productData.product.id) {
      console.error('Failed to create product');
      return;
    }

    const productId = productData.product.id;

    // Test creating a variation
    const variationResponse = await fetch('http://localhost:3000/api/variations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        product_id: productId,
        name: 'Test Variation',
        color: 'Red',
        size: 'M',
        price: 90,
        stock: 5
      })
    });

    const variationData = await variationResponse.json();
    console.log('Variation created:', variationData);

    // Test getting variations for the product
    const getVariationsResponse = await fetch(`http://localhost:3000/api/variations/product/${productId}`);
    const getVariationsData = await getVariationsResponse.json();
    console.log('Variations for product:', getVariationsData);

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testVariations();
/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
    const { discount = 0, sale_price = 0, quantity = 0 } = purchase;
    const discountDecimal = Number(discount) / 100;
    const fullAmount = Number(sale_price) * Number(quantity);

    return fullAmount * (1 - discountDecimal);
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    const { profit = 0 } = seller;

    if (index === 0) {
        return profit * 0.15;
    }

    if (index === 1 || index === 2) {
        return profit * 0.10;
    }

    if (index === total - 1) {
        return 0;
    }

    return profit * 0.05;
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
    if (!data
        || !Array.isArray(data.products)
        || data.products.length === 0
        || !Array.isArray(data.sellers)
        || data.sellers.length === 0
        || !Array.isArray(data.purchase_records)
        || data.purchase_records.length === 0
    ) {
        throw new Error('Некорректные входные данные');
    }

    if (!options || typeof options !== 'object') {
        throw new Error('Options must be an object');
    }

    const { calculateRevenue, calculateBonus } = options;

    if (typeof calculateRevenue !== 'function') {
        throw new Error('calculateRevenue function is required');
    }

    if (typeof calculateBonus !== 'function') {
        throw new Error('calculateBonus function is required');
    }

    const products = data.products;
    const sellers = data.sellers;
    const purchaseRecords = data.purchase_records;

    const productIndex = products.reduce((index, product) => {
        if (product && typeof product.sku === 'string') {
            index[product.sku] = product;
        }
        return index;
    }, {});

    const sellerStats = sellers.map((seller) => {
        const nameParts = [];

        if (typeof seller.first_name === 'string') {
            nameParts.push(seller.first_name);
        }

        if (typeof seller.last_name === 'string') {
            nameParts.push(seller.last_name);
        }

        return {
            id: seller.id,
            seller_id: seller.id,
            name: nameParts.join(' '),
            revenue: 0,
            profit: 0,
            sales_count: 0,
            products_sold: {}
        };
    });

    const sellerIndex = sellerStats.reduce((index, seller) => {
        if (!seller || typeof seller.id !== 'string') {
            return index;
        }

        index[seller.id] = seller;
        return index;
    }, {});

    purchaseRecords.forEach((record) => {
        if (!record || typeof record.seller_id !== 'string') {
            return;
        }

        const sellerStats = sellerIndex[record.seller_id];

        if (!sellerStats) {
            return;
        }

        sellerStats.sales_count += 1;
        sellerStats.revenue += Number(record.total_amount) || 0;

        const items = Array.isArray(record.items) ? record.items : [];

        items.forEach((item) => {
            if (!item || typeof item.sku !== 'string') {
                return;
            }

            const product = productIndex[item.sku];
            const quantity = Number(item.quantity) || 0;
            const costPrice = Number(product?.purchase_price) || 0;
            const cost = costPrice * quantity;
            const revenue = Number(calculateRevenue(item, product)) || 0;
            const profit = revenue - cost;

            sellerStats.profit += profit;

            if (!sellerStats.products_sold[item.sku]) {
                sellerStats.products_sold[item.sku] = 0;
            }

            sellerStats.products_sold[item.sku] += quantity;
        });
    });

    sellerStats.sort((a, b) => {
        if (b.profit !== a.profit) {
            return b.profit - a.profit;
        }

        return a.seller_id.localeCompare(b.seller_id);
    });

    const totalSellers = sellerStats.length;

    sellerStats.forEach((seller, index) => {
        seller.bonus = calculateBonus(index, totalSellers, seller);
        seller.top_products = Object.entries(seller.products_sold)
            .map(([sku, quantity]) => ({ sku, quantity }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);
    });

    return sellerStats.map((sellerStats) => ({
        seller_id: sellerStats.seller_id,
        name: sellerStats.name,
        sales_count: sellerStats.sales_count,
        revenue: +sellerStats.revenue.toFixed(2),
        profit: +sellerStats.profit.toFixed(2),
        bonus: +sellerStats.bonus.toFixed(2),
        top_products: sellerStats.top_products
    }));
}

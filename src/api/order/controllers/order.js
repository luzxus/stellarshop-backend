// @ts-ignore
const stripe = require('stripe')(process.env.STRIPE_TEST_KEY);


'use strict';

/**
 * order controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::order.order', ({ strapi }) => ({
    async create(ctx) {
        // @ts-ignore
        const { products } = ctx.request.body || [];
        console.log("products", products)


        const lineItems = await Promise.all(
            products.map(async (product) => {
                //for each product that comes from the Frontend, we want to search for it in the backend and then pass its details in the return statement
                const item = await strapi
                    .service("api::product.product")
                    .findOne(product.id)

                console.log("item", item)

                //Refer to the stripe docs to see the what properties exist in the line_items
                return {
                    price_data: {
                        currency: "sek",
                        product_data: {
                            name: item.title
                        },
                        unit_amount: item.price * 100
                    },
                    quantity: product.quantity

                }
            })
        )

        try {

            const session = await stripe.checkout.sessions.create({
                mode: 'payment',
                success_url: `${process.env.CLIENT_URL}?success=true`,
                cancel_url: `${process.env.CLIENT_URL}?canceled=true`,
                line_items: lineItems,
                //shipping_address_collection: {allowed_countries:["SE"]} om vi vill ha frakt
                payment_method_types: ["card"]
            });
            //om allt funkat bra så skickar vi denna infon till vår databas
            await strapi.service("api::order.order").create({
                data: {
                    products,
                    stripeId: session.id,
                }
            });
            return { stripeSession: session }

        } catch (err) {
            ctx.response.status = 500;
            return err;
        }
    }
}));

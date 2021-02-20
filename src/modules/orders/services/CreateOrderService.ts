import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    // TODO
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer not exist');
    }

    const productsExists = await this.productsRepository.findAllById(products);

    if (!productsExists.length) {
      throw new AppError('Could not find any product with the given ids');
    }

    const productsExistsIds = productsExists.map(product => product.id);

    const checkMissingProducts = products.filter(
      product => !productsExistsIds.includes(product.id),
    );

    if (checkMissingProducts.length) {
      throw new AppError(
        `Could not find product ${checkMissingProducts[0].id}`,
      );
    }

    const findProductsNotAvailable = products.filter(
      product =>
        productsExists.filter(p => p.id === product.id)[0].quantity <
        product.quantity,
    );

    if (findProductsNotAvailable.length) {
      throw new AppError(
        `The quantity ${findProductsNotAvailable[0].quantity} is not available for ${findProductsNotAvailable[0].id}`,
      );
    }

    const serilizedProducts = products.map(product => {
      const { id, quantity } = product;
      const { price } = productsExists.filter(p => p.id === id)[0];
      return { product_id: id, price, quantity };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: serilizedProducts,
    });

    const { order_products } = order;

    const ordersProductsQuantity = order_products.map(product => ({
      id: product.product_id,
      quantity:
        productsExists.filter(p => p.id === product.product_id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(ordersProductsQuantity);

    return order;
  }
}

export default CreateOrderService;

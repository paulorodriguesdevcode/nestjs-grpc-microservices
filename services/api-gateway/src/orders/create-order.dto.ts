import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsNumber,
  IsPositive,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class OrderItemDto {
  @IsString()
  @MinLength(1)
  productName!: string;

  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsNumber()
  @IsPositive()
  unitPrice!: number;
}

export class CreateOrderDto {
  @IsUUID()
  userId!: string;

  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  @ArrayMinSize(1)
  items!: OrderItemDto[];
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessException } from '../../common/business.exception';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { Setmeal } from '../../entities/setmeal.entity';
import { CreateSetmealDto } from './dto/create-setmeal.dto';
import { UpdateSetmealDto } from './dto/update-setmeal.dto';

export interface SetmealGroupDish {
  id: number;
  name: string;
  category: string;
  price: number;
  type: string;
  weight?: number;
}

export interface SetmealGroup {
  name: string;
  type: string;
  min_choose?: number;
  dishes: SetmealGroupDish[];
}

export interface SetmealItem {
  id: number;
  code: string;
  name: string;
  category: string;
  price: number;
  groups: SetmealGroup[];
  print_enable: boolean;
  print_dept: string;
  status: string;
  min_amount: number;
  created_at: Date;
}

@Injectable()
export class SetmealsService {
  constructor(
    @InjectRepository(Setmeal)
    private readonly setmealRepo: Repository<Setmeal>,
  ) {}

  async list(user: AuthUser): Promise<SetmealItem[]> {
    const items = await this.setmealRepo.find({
      where: { shop_id: user.shopId },
      order: { id: 'ASC' },
    });
    return items.map((s) => this.toItem(s));
  }

  async create(user: AuthUser, dto: CreateSetmealDto): Promise<SetmealItem> {
    const setmeal = await this.setmealRepo.save(
      this.setmealRepo.create({
        shop_id: user.shopId,
        code: dto.code || '',
        name: dto.name,
        category: dto.category || '',
        price: dto.price ?? 0,
        groups: JSON.stringify(dto.groups ?? []),
        print_enable: dto.print_enable ?? true,
        print_dept: dto.print_dept || '',
        status: dto.status || 'on',
        min_amount: dto.min_amount ?? 0,
      }),
    );
    return this.toItem(setmeal);
  }

  async update(user: AuthUser, id: number, dto: UpdateSetmealDto): Promise<SetmealItem> {
    const setmeal = await this.findInShop(user, id);
    if (dto.code !== undefined) setmeal.code = dto.code;
    if (dto.name !== undefined) setmeal.name = dto.name;
    if (dto.category !== undefined) setmeal.category = dto.category;
    if (dto.price !== undefined) setmeal.price = dto.price;
    if (dto.groups !== undefined) setmeal.groups = JSON.stringify(dto.groups);
    if (dto.print_enable !== undefined) setmeal.print_enable = dto.print_enable;
    if (dto.print_dept !== undefined) setmeal.print_dept = dto.print_dept;
    if (dto.status !== undefined) setmeal.status = dto.status;
    if (dto.min_amount !== undefined) setmeal.min_amount = dto.min_amount;
    await this.setmealRepo.save(setmeal);
    return this.toItem(setmeal);
  }

  async remove(user: AuthUser, id: number): Promise<void> {
    const setmeal = await this.findInShop(user, id);
    await this.setmealRepo.remove(setmeal);
  }

  private async findInShop(user: AuthUser, id: number): Promise<Setmeal> {
    const setmeal = await this.setmealRepo.findOne({ where: { id } });
    if (!setmeal || setmeal.shop_id !== user.shopId) {
      throw new BusinessException('套餐不存在');
    }
    return setmeal;
  }

  private toItem(s: Setmeal): SetmealItem {
    let groups: SetmealGroup[] = [];
    try {
      const parsed = JSON.parse(s.groups || '[]');
      groups = Array.isArray(parsed) ? parsed : [];
    } catch {
      groups = [];
    }
    return {
      id: s.id,
      code: s.code,
      name: s.name,
      category: s.category,
      price: s.price,
      groups,
      print_enable: s.print_enable,
      print_dept: s.print_dept,
      status: s.status,
      min_amount: s.min_amount,
      created_at: s.created_at,
    };
  }
}

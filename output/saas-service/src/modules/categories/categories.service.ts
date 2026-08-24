import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessException } from '../../common/business.exception';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { Category } from '../../entities/category.entity';
import { Dish } from '../../entities/dish.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

export interface CategoryItem {
  id: number;
  parent_id: number | null;
  name: string;
  code: string;
  show_on_mobile: boolean;
  belong: string;
  sort_order: number;
  dish_count: number;
  created_at: Date;
}

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Dish)
    private readonly dishRepo: Repository<Dish>,
  ) {}

  /** 本店全部分类（含菜品数） */
  async list(user: AuthUser): Promise<CategoryItem[]> {
    const [categories, dishRows] = await Promise.all([
      this.categoryRepo.find({
        where: { shop_id: user.shopId },
        order: { sort_order: 'ASC', id: 'ASC' },
      }),
      this.dishRepo
        .createQueryBuilder('d')
        .select('d.category', 'category')
        .addSelect('COUNT(*)', 'cnt')
        .where('d.shop_id = :shopId', { shopId: user.shopId })
        .groupBy('d.category')
        .getRawMany(),
    ]);
    const countMap = new Map<string, number>();
    for (const row of dishRows) {
      if (row.category) countMap.set(String(row.category), Number(row.cnt));
    }
    return categories.map((c) => ({
      ...this.toItem(c),
      dish_count: countMap.get(c.name) ?? 0,
    }));
  }

  async create(user: AuthUser, dto: CreateCategoryDto): Promise<CategoryItem> {
    const max = await this.categoryRepo.findOne({
      where: { shop_id: user.shopId },
      order: { sort_order: 'DESC' },
    });
    const category = await this.categoryRepo.save(
      this.categoryRepo.create({
        shop_id: user.shopId,
        parent_id: dto.parent_id ?? null,
        name: dto.name,
        code: dto.code || '',
        show_on_mobile: dto.show_on_mobile ?? true,
        belong: dto.belong || '门店',
        sort_order: dto.sort_order ?? (max ? max.sort_order + 1 : 1),
      }),
    );
    return this.toItem(category);
  }

  async update(user: AuthUser, id: number, dto: UpdateCategoryDto): Promise<CategoryItem> {
    const category = await this.findInShop(user, id);
    if (dto.name !== undefined) category.name = dto.name;
    if (dto.parent_id !== undefined) category.parent_id = dto.parent_id;
    if (dto.code !== undefined) category.code = dto.code;
    if (dto.show_on_mobile !== undefined) category.show_on_mobile = dto.show_on_mobile;
    if (dto.belong !== undefined) category.belong = dto.belong;
    if (dto.sort_order !== undefined) category.sort_order = dto.sort_order;
    await this.categoryRepo.save(category);
    return this.toItem(category);
  }

  async remove(user: AuthUser, id: number): Promise<void> {
    const category = await this.findInShop(user, id);
    await this.categoryRepo.remove(category);
  }

  private async findInShop(user: AuthUser, id: number): Promise<Category> {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category || category.shop_id !== user.shopId) {
      throw new BusinessException('分类不存在');
    }
    return category;
  }

  private toItem(c: Category): CategoryItem {
    return {
      id: c.id,
      parent_id: c.parent_id,
      name: c.name,
      code: c.code,
      show_on_mobile: c.show_on_mobile,
      belong: c.belong,
      sort_order: c.sort_order,
      dish_count: 0,
      created_at: c.created_at,
    };
  }
}

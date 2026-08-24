import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessException } from '../../common/business.exception';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { Attribute } from '../../entities/attribute.entity';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';

export interface AttributeItem {
  id: number;
  kind: string;
  name: string;
  preset: boolean;
  sort_order: number;
  created_at: Date;
}

const ATTRIBUTE_KINDS = ['spec', 'method', 'unit'] as const;

@Injectable()
export class AttributesService {
  constructor(
    @InjectRepository(Attribute)
    private readonly attributeRepo: Repository<Attribute>,
  ) {}

  async list(user: AuthUser, kind?: string): Promise<AttributeItem[]> {
    if (kind && !(ATTRIBUTE_KINDS as readonly string[]).includes(kind)) {
      throw new BusinessException('无效的属性类型');
    }
    const items = await this.attributeRepo.find({
      where: kind ? { shop_id: user.shopId, kind } : { shop_id: user.shopId },
      order: { sort_order: 'ASC', id: 'ASC' },
    });
    return items.map((a) => this.toItem(a));
  }

  async create(user: AuthUser, dto: CreateAttributeDto): Promise<AttributeItem> {
    if (!(ATTRIBUTE_KINDS as readonly string[]).includes(dto.kind)) {
      throw new BusinessException('无效的属性类型');
    }
    const max = await this.attributeRepo.findOne({
      where: { shop_id: user.shopId, kind: dto.kind },
      order: { sort_order: 'DESC' },
    });
    const attribute = await this.attributeRepo.save(
      this.attributeRepo.create({
        shop_id: user.shopId,
        kind: dto.kind,
        name: dto.name,
        preset: dto.preset ?? false,
        sort_order: dto.sort_order ?? (max ? max.sort_order + 1 : 1),
      }),
    );
    return this.toItem(attribute);
  }

  async update(user: AuthUser, id: number, dto: UpdateAttributeDto): Promise<AttributeItem> {
    const attribute = await this.findInShop(user, id);
    if (dto.name !== undefined) attribute.name = dto.name;
    if (dto.kind !== undefined) {
      if (!(ATTRIBUTE_KINDS as readonly string[]).includes(dto.kind)) {
        throw new BusinessException('无效的属性类型');
      }
      attribute.kind = dto.kind;
    }
    if (dto.preset !== undefined) attribute.preset = dto.preset;
    if (dto.sort_order !== undefined) attribute.sort_order = dto.sort_order;
    await this.attributeRepo.save(attribute);
    return this.toItem(attribute);
  }

  async remove(user: AuthUser, id: number): Promise<void> {
    const attribute = await this.findInShop(user, id);
    await this.attributeRepo.remove(attribute);
  }

  private async findInShop(user: AuthUser, id: number): Promise<Attribute> {
    const attribute = await this.attributeRepo.findOne({ where: { id } });
    if (!attribute || attribute.shop_id !== user.shopId) {
      throw new BusinessException('属性不存在');
    }
    return attribute;
  }

  private toItem(a: Attribute): AttributeItem {
    return {
      id: a.id,
      kind: a.kind,
      name: a.name,
      preset: a.preset,
      sort_order: a.sort_order,
      created_at: a.created_at,
    };
  }
}

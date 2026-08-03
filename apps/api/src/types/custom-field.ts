import { AppError } from '../middleware/error';

/** 报名表单自定义字段 */
export interface CustomField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea';
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

export const CUSTOM_FIELD_TYPES = ['text', 'number', 'select', 'textarea'] as const;

/** 校验赛事自定义字段配置（创建/更新时调用） */
export function validateCustomFields(fields: unknown): CustomField[] {
  if (fields === undefined || fields === null) return [];
  if (!Array.isArray(fields)) throw new AppError('INVALID_INPUT', '报名表单格式无效', 400);
  const seen = new Set<string>();
  for (const f of fields) {
    const field = f as Record<string, unknown>;
    if (!field || typeof field !== 'object' || Array.isArray(field)) {
      throw new AppError('INVALID_INPUT', '字段格式无效', 400);
    }
    const key = String(field.key ?? '').trim();
    if (!/^[a-zA-Z0-9_-]{1,32}$/.test(key)) {
      throw new AppError('INVALID_INPUT', `字段标识无效：${key || '(空)'}`, 400);
    }
    if (seen.has(key)) throw new AppError('INVALID_INPUT', `字段标识重复：${key}`, 400);
    seen.add(key);
    const label = String(field.label ?? '').trim();
    if (!label) throw new AppError('INVALID_INPUT', `字段「${key}」缺少名称`, 400);
    if (!CUSTOM_FIELD_TYPES.includes(field.type as (typeof CUSTOM_FIELD_TYPES)[number])) {
      throw new AppError('INVALID_INPUT', `字段「${key}」类型无效`, 400);
    }
    if (field.type === 'select' && (!Array.isArray(field.options) || field.options.length === 0)) {
      throw new AppError('INVALID_INPUT', `字段「${key}」需要至少一个选项`, 400);
    }
  }
  return fields as CustomField[];
}

/** 校验报名提交的 answers（必填/选项合法性），返回规范化对象 */
export function validateAnswers(fields: CustomField[], answers: unknown): Record<string, string> {
  const map: Record<string, string> = {};
  if (answers != null) {
    if (typeof answers !== 'object' || Array.isArray(answers)) {
      throw new AppError('INVALID_INPUT', '报名表单答案格式无效', 400);
    }
    for (const [k, v] of Object.entries(answers as Record<string, unknown>)) {
      if (v != null && typeof v !== 'string') {
        throw new AppError('INVALID_INPUT', '报名表单答案格式无效', 400);
      }
      map[k] = String(v ?? '');
    }
  }
  for (const f of fields) {
    const v = map[f.key] ?? '';
    if (f.required && v.trim() === '') {
      throw new AppError('INVALID_INPUT', `请填写「${f.label}」`, 400);
    }
    if (f.type === 'select' && v.trim() !== '' && f.options && !f.options.includes(v)) {
      throw new AppError('INVALID_INPUT', `「${f.label}」选项无效`, 400);
    }
  }
  return map;
}

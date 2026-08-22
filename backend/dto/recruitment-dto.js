export function toJobDto(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    title: row.title,
    type: row.type,
    salary: row.salary,
    description: row.description,
    requirements: row.requirements,
    benefits: row.benefits || null,
    is_active: Boolean(row.is_active),
    stores: Array.isArray(row.stores) ? row.stores : [],
    created_at: row.created_at,
  };
}

export function toJobApplicationDto(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    job_id: Number(row.job_id),
    job_title: row.job_title || row.title || 'Vị trí đã xóa',
    job_type: row.job_type || null,
    store_id: row.store_id == null ? null : Number(row.store_id),
    store_name: row.store_name || 'Toàn hệ thống',
    fullname: row.fullname,
    phone: row.phone,
    email: row.email,
    cv_url: row.cv_url || null,
    status: row.status || 'Mới',
    note: row.note || null,
    created_at: row.created_at,
  };
}

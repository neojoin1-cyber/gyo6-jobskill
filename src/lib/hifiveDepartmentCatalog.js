import catalog from '../../data/hifive-department-catalog.json'

export const HIFIVE_DEPARTMENT_SOURCE = catalog.source
export const HIFIVE_DEPARTMENT_SUMMARY = catalog.summary
export const HIFIVE_PRIORITY_DEPARTMENTS = catalog.priorityDepartments
export const HIFIVE_EXPANSION_DEPARTMENTS = catalog.expansionDepartments

const allDepartments = [...HIFIVE_PRIORITY_DEPARTMENTS, ...HIFIVE_EXPANSION_DEPARTMENTS]
const departmentByName = new Map(allDepartments.map(item => [item.name, item]))

export function hifiveDepartment(name) {
  return departmentByName.get(String(name || '').trim()) || null
}

export function hifiveDepartmentOptions({ includeExpansion = false } = {}) {
  return includeExpansion ? allDepartments : HIFIVE_PRIORITY_DEPARTMENTS
}

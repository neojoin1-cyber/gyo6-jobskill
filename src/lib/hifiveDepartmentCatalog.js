import catalog from '../../data/hifive-department-catalog.json'

export const HIFIVE_DEPARTMENT_SOURCE = catalog.source
export const HIFIVE_DEPARTMENT_SUMMARY = catalog.summary
export const HIFIVE_PRIORITY_DEPARTMENTS = catalog.priorityDepartments
export const HIFIVE_EXPANSION_DEPARTMENTS = catalog.expansionDepartments

const koreanSort = (a, b) => a.name.localeCompare(b.name, 'ko-KR', { sensitivity: 'base' })
const allDepartments = [...HIFIVE_PRIORITY_DEPARTMENTS, ...HIFIVE_EXPANSION_DEPARTMENTS].sort(koreanSort)
const priorityDepartments = [...HIFIVE_PRIORITY_DEPARTMENTS].sort(koreanSort)
const departmentByName = new Map(allDepartments.map(item => [item.name.replace(/\s+/g, '').toLocaleLowerCase('ko-KR'), item]))

export function hifiveDepartment(name) {
  return departmentByName.get(String(name || '').replace(/\s+/g, '').toLocaleLowerCase('ko-KR')) || null
}

export function hifiveDepartmentOptions({ includeExpansion = false } = {}) {
  return includeExpansion ? allDepartments : priorityDepartments
}

export function searchHifiveDepartments(query, { includeExpansion = true, limit = 24 } = {}) {
  const source = includeExpansion ? allDepartments : priorityDepartments
  const keyword = String(query || '').replace(/\s+/g, '').toLocaleLowerCase('ko-KR')
  if (!keyword) return source.slice(0, limit)
  return source
    .filter(item => item.name.replace(/\s+/g, '').toLocaleLowerCase('ko-KR').includes(keyword))
    .sort((a, b) => {
      const aStarts = a.name.replace(/\s+/g, '').toLocaleLowerCase('ko-KR').startsWith(keyword)
      const bStarts = b.name.replace(/\s+/g, '').toLocaleLowerCase('ko-KR').startsWith(keyword)
      return Number(bStarts) - Number(aStarts) || koreanSort(a, b)
    })
    .slice(0, limit)
}

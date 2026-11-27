export function reportLines(report) {
  if (!report || report.network !== 'Ethereum Sepolia' || !report.summary) throw new TypeError('Invalid report');
  const filters = new Map([['all','Все'],['incoming','Входящие'],['outgoing','Исходящие']]);
  if (!filters.has(report.filter)) throw new TypeError('Invalid filter');
  const s = report.summary;
  return [
    'Crypto Insight Report',
    'Ethereum Sepolia — тестовая сеть, не реальные финансовые активы',
    'Источник: Blockscout',
    'Адрес: ' + report.address,
    'Дата формирования (UTC): ' + report.generatedAt,
    'Фильтр: ' + filters.get(report.filter),
    'Загружено записей: ' + s.loaded,
    'Входящие: ' + s.incoming,
    'Исходящие: ' + s.outgoing,
    'Переводы на собственный адрес: ' + s.self,
    'Не классифицировано: ' + s.unknown,
    report.hasMore ? 'Есть дополнительные страницы.' : 'Источник не указал следующую страницу.',
    'Анализ только загруженных записей выбранного фильтра, не всей истории адреса.',
    'Отчёт не подтверждает безопасность адреса и не является финансовой рекомендацией.'
  ];
}
export function renderReport(container, report) {
  const lines = reportLines(report);
  const doc = container.ownerDocument;
  const nodes = lines.map((line, index) => {
    const element = doc.createElement(index === 0 ? 'h2' : 'p');
    element.textContent = line;
    return element;
  });
  container.replaceChildren(...nodes);
}

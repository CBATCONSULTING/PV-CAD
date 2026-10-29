// Capacity-only view: original Extrabat dates remain untouched.
function capacityNextDate(key) {
  const date = new Date(key + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
function capacityWorkingDay(key) {
  const weekday = new Date(key + 'T12:00:00Z').getUTCDay();
  return weekday !== 0 && weekday !== 6 && !isFrenchHoliday(key);
}
function capacityMultiEntries(resource, date) {
  return (resource.multi_day_events || []).filter(event => event.dates.includes(date))
    .map(event => ({start: 480, end: 1020, text: event.text}));
}
function capacityPendingInstallCounts(data) {
  const counts = new Map(), reports = [], seen = new Set();
  const dates = [...new Set(data.resources.flatMap(resource => Object.keys(resource.days || {})))].sort();
  const first = dates[0], last = dates.at(-1);
  for (const resource of data.resources.filter(resource => norm(resource.name).includes('a planifier chantier'))) {
    for (const event of resource.multi_day_events || []) {
      const label = norm(event.text);
      if (!label.includes('pose cuisine') || label.includes('sav cuisine') || explicitUnavailability(label)) continue;
      const source = [...new Set(event.dates)].sort();
      if (!source.length || source.some(date => !/^\d{4}-\d{2}-\d{2}$/.test(date))) throw new Error('Dates de pose sur plusieurs jours invalides. Relancez le lanceur 0.7.8.');
      for (let i = 1; i < source.length; i++) {
        if (capacityNextDate(source[i - 1]) !== source[i]) throw new Error('Durée de pose incomplète dans l’export Extrabat.');
      }
      const identity = event.id + '|' + source[0];
      if (seen.has(identity)) continue;
      seen.add(identity);
      // A task touching the exported boundary may start earlier or end later.
      if (source[0] === first || source.at(-1) === last) throw new Error('Une pose en attente atteint la limite des agendas exportés. Sa durée complète est nécessaire pour calculer les capacités.');
      const effective = [];
      let cursor = source[0];
      while (effective.length < source.length) {
        if (capacityWorkingDay(cursor)) effective.push(cursor);
        cursor = capacityNextDate(cursor);
      }
      if (effective.at(-1) > last) throw new Error('Le report d’une pose dépasse la période des agendas chargés. Chargez davantage de semaines.');
      for (const date of effective) counts.set(date, (counts.get(date) || 0) + 1);
      if (source.join('|') !== effective.join('|')) reports.push({text: event.text, source, effective});
    }
  }
  return {counts, reports};
}

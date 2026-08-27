import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const jsx = moduleUrl('export const jsx = (type, props) => ({type, props}); export const jsxs = jsx;');
async function load(path, imports = {}) {
  let code = ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX},
  }).outputText;
  for (const [name, url] of Object.entries({'react/jsx-runtime': jsx, ...imports})) code = code.replaceAll(`"${name}"`, `"${url}"`);
  return import(moduleUrl(code));
}
const translation = moduleUrl(`export const useTranslation = () => ({t: {common: {back: '뒤로'}, reservation: {title: '예약', myBookingsTitle: '내 예약', availableProgramTitle: '프로그램', policyCancel: () => '', policyNoShow: () => ''}}, locale: 'ko'}); export const useAutoTranslate = () => ({translated: {}});`);
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
}

test('direct visitor links always return inside the app, with ESG children returning to ESG', async () => {
  const {VisitorPageTitle} = await load('../src/widgets/visitor-nav/visitor-page-title.tsx', {
    'next/link': moduleUrl('export default "Link";'),
    'next/navigation': moduleUrl('export const usePathname = () => globalThis.visitorFlowPath;'),
    'lucide-react': moduleUrl('export const ChevronLeft = "ChevronLeft";'),
    '@/shared/lib/i18n': translation,
    './visitor-nav': moduleUrl('export const NAV_ITEMS = [{href: "/visitor"}, {href: "/visitor/reservation"}, {href: "/visitor/coupons"}];'),
  });
  try {
    for (const [path, href] of [
      ['/visitor/survey', '/visitor'], ['/visitor/coupons/wallet', '/visitor/coupons'],
      ['/visitor/stamp-tour', '/visitor/coupons'], ['/visitor/reservation', undefined],
    ]) {
      globalThis.visitorFlowPath = path;
      assert.equal(nodes(VisitorPageTitle({children: '제목'})).find(node => node.type === 'Link')?.props.href, href);
    }
  } finally { delete globalThis.visitorFlowPath; }
});

test('empty bookings lead to programs and successful booking returns to booking management', async () => {
  const values = [];
  let cursor = 0;
  const writes = [];
  globalThis.visitorFlowHarness = {
    state(initial) { const index = cursor++; if (!(index in values)) values[index] = initial; return [values[index], value => { values[index] = value; }]; },
    writes,
  };
  const imports = {
    react: moduleUrl('export const useState = initial => globalThis.visitorFlowHarness.state(initial);'),
    '@tanstack/react-query': moduleUrl('export const useQuery = () => ({data: [], isLoading: false, isError: false});'),
    '@/shared/lib/use-write': moduleUrl('export const useWrite = (fn, options) => {globalThis.visitorFlowHarness.writes.push(options); return {};};'),
    '@/shared/lib/i18n': translation,
    '@/shared/lib/use-now': moduleUrl('export const useNow = () => 0;'),
    '@/shared/lib/booking-policy': moduleUrl('export const BOOKING_CANCEL_DEADLINE_MINUTES = 30, BOOKING_NO_SHOW_GRACE_MINUTES = 10, isCancelDeadlinePassed = () => false;'),
    '@/entities/booking': moduleUrl('export const cancelBooking = () => {}, createBooking = () => {}, fetchBookableSessions = () => {}, fetchVisitorBookings = () => {}, saveReservationPhone = () => {}, MAX_PARTY_SIZE = 10;'),
  };
  for (const [path, names] of Object.entries({
    'lucide-react': ['Clock', 'Info', 'MapPin', 'Ticket', 'Users', 'X'],
    button: ['Button'], badge: ['Badge'], dialog: ['Dialog', 'DialogContent', 'DialogDescription', 'DialogHeader', 'DialogTitle'],
    form: ['Form', 'SubmitButton'], input: ['Input'], label: ['Label'], 'query-state': ['QueryState'],
    tabs: ['Tabs', 'TabsContent', 'TabsList', 'TabsTrigger'], skeleton: ['Skeleton', 'SkeletonList'],
  })) imports[path === 'lucide-react' ? path : `@/shared/ui/${path}`] = moduleUrl(names.map(name => `export const ${name} = "${name}";`).join(''));
  try {
    const {default: Page} = await load('../src/app/(public)/visitor/reservation/page.tsx', imports);
    const render = () => { cursor = 0; writes.length = 0; return nodes(Page()); };
    let tree = render();
    assert.equal(tree.find(node => node.type === 'Tabs').props.value, 'programs');
    tree.find(node => node.type === 'Tabs').props.onValueChange('bookings');
    tree = render();
    assert.equal(tree.find(node => node.type === 'Tabs').props.value, 'bookings');
    tree.find(node => node.type === 'Button' && node.props.children === '프로그램').props.onClick();
    assert.equal(render().find(node => node.type === 'Tabs').props.value, 'programs');
    writes[0].onSuccess({id: 'booking-1'}, {});
    assert.equal(render().find(node => node.type === 'Tabs').props.value, 'bookings');
  } finally { delete globalThis.visitorFlowHarness; }
});

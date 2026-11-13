import type axe from 'axe-core';
function audit() {
  cy.readFile('../../node_modules/axe-core/axe.min.js', { log: false }).then(source => cy.window().then(async win => {
    win.eval(source);
    const result = await (win as unknown as { axe: typeof axe }).axe.run(win.document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
    expect(result.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).to.deep.eq([]);
  }));
}
function budget() {
  cy.request({ url: '/api/health', failOnStatusCode: false, log: false }).then(response => {
    const header = String(response.headers.ratelimit ?? '');
    if (response.status === 429 || Number(header.match(/r=(\d+)/)?.[1] ?? 300) < 20) cy.wait(Math.min((Number(header.match(/t=(\d+)/)?.[1] ?? 1) + 1) * 1000, 59000), { log: false }).then(budget);
  });
}
describe('Student profile sections and dialog keyboard access', () => {
  for (const mode of ['light', 'dark']) for (const width of [360, 1440]) {
    it(`checks availability, reviews, and modal focus at ${width}px in ${mode}`, () => {
      budget();
      cy.viewport(width, 1000);
      cy.task<{ email: string; password: string }[]>('demoAccounts', null, { log: false }).then(accounts => {
        cy.visit('/login', { onBeforeLoad(win) { win.localStorage.setItem('komek-theme', mode); } });
        cy.get('input[name="email"]').type(accounts[0].email);
        cy.get('input[name="password"]').type(accounts[0].password, { log: false });
        cy.contains('button', 'Sign in').click();
        cy.location('pathname').should('eq', '/dashboard');
      });
      cy.visit('/students/aitu-demo02');
      cy.contains('button', 'Availability').click();
      cy.get('[aria-label="Monday 10:00 UTC available"]').should('be.visible');
      cy.document().then(doc => expect(doc.documentElement.scrollWidth).to.be.at.most(width));
      audit();
      cy.screenshot(`${mode}-${width}-profile-availability`, { capture: 'viewport', scale: true });
      cy.contains('button', /^Reviews/).click();
      audit();
      cy.screenshot(`${mode}-${width}-profile-reviews`, { capture: 'viewport', scale: true });
      cy.contains('button', 'About & skills').click();
      cy.contains('button', 'Block student').click();
      cy.get('[role="dialog"]').should('be.visible');
      audit();
      cy.screenshot(`${mode}-${width}-confirmation-dialog`, { capture: 'viewport', scale: true });
      cy.get('body').type('{esc}');
      cy.get('[role="dialog"]').should('not.exist');
      cy.contains('button', 'Block student').should('have.focus');
    });
  }
});

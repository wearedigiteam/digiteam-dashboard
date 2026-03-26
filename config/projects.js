// ── Project Configuration ─────────────────────────────────────────────────────
// Map each project's GitHub repo name to its Userback project ID.
// To find your Userback project IDs, visit the dashboard and check the URL
// when viewing a project, or use the /api/userback-projects endpoint which
// will list all projects and their IDs.
//
// Set githubRepo to null if a project has no GitHub repo.
// Set userbackId to null if a project has no Userback project.

const PROJECTS = [
  {
    name: 'CDA Website Redesign',
    githubRepo: 'cda-website-redesign',
    userbackId: '135347',
  },
  {
    name: 'Vera Therapeutics',
    githubRepo: 'veratx-wp-redesign',
    userbackId: '136797', 
  },
  {
    name: 'Northern Arizona Healthcare',
    githubRepo: 'NAHealth',
    userbackId: '70261',
  },
  {
    name: 'Magna',
    githubRepo: 'Magna',
    userbackId: '77643',
  },
  {
    name: 'First National - Brokers',
    githubRepo: 'FirstNationalBrokers-Core',
    userbackId: '47672',
  },
  {
    name: 'First National',
    githubRepo: '201177-000-FirstNational',
    userbackId: '47672',
  },
  {
    name: 'CaGBC',
    githubRepo: 'CaGBC',
    userbackId: '59184',
  },
  {
    name: 'OCI',
    githubRepo: 'OCI-CIT',
    userbackId: '72207',
  },
  {
    name: 'Net2Phone',
    githubRepo: 'n2p-hubspot-theme-2025',
    userbackId: '76574',
  },
  {
    name: 'Earnscliffe',
    githubRepo: 'Earnscliffe',
    userbackId: '82745',
  },
  {
    name: 'Luft Financial',
    githubRepo: '521627-010-Luft-Financial-Website-Development',
    userbackId: '85633',
  },
  {
    name: 'Capstone Copper',
    githubRepo: 'Capstone-Copper-WordPress-Redesign',
    userbackId: '76321',
  },
];

export default PROJECTS;
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
    userbackId: null, // replace with your Userback project ID
  },
  {
    name: 'Vera Therapeutics',
    githubRepo: 'veratx-wp-redesign',
    userbackId: null,
  },
  {
    name: 'Northern Arizona Healthcare',
    githubRepo: 'NAHealth',
    userbackId: null,
  },
  {
    name: 'Magna',
    githubRepo: 'Magna',
    userbackId: null,
  },
  {
    name: 'First National',
    githubRepo: 'FirstNationalBrokers-Core',
    userbackId: null,
  },
  {
    name: 'CaGBC',
    githubRepo: 'CaGBC',
    userbackId: null,
  },
  {
    name: 'OCI',
    githubRepo: 'OCI-CIT',
    userbackId: null,
  },
  {
    name: 'Net2Phone',
    githubRepo: 'n2p-hubspot-theme-2025',
    userbackId: null,
  },
  {
    name: 'Earnscliffe',
    githubRepo: 'Earnscliffe',
    userbackId: null,
  },
  {
    name: 'Luft Financial',
    githubRepo: '521627-010-Luft-Financial-Website-Development',
    userbackId: null,
  },
  // Add more projects here as needed
  // { name: 'Client Name', githubRepo: 'repo-name', userbackId: '12345' },
];

export default PROJECTS;

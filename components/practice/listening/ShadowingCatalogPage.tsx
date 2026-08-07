import React from 'react';
import ListeningCatalogPage from './ListeningCatalogPage';

// /practice/shadowing — the Shadowing sidebar's entry point.
//
// A THIN WRAPPER, DELIBERATELY. This is the same recordings, the same
// categories and the same query plumbing as /practice/listening; only the
// active mode differs, and ListeningCatalogPage already takes that as a prop.
// A second implementation here would be a second place to fix every catalog
// bug — see that file's own header comment for the full reasoning.
const ShadowingCatalogPage: React.FC = () => <ListeningCatalogPage mode="SHADOWING" />;

export default ShadowingCatalogPage;

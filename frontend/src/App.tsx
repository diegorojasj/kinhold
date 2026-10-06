import { Route, Router } from '@solidjs/router';
import { type Component, lazy } from 'solid-js';
import { AppShell } from './components/AppShell';

// Each screen is its own chunk, so phones only download what they open.
const Home = lazy(() => import('./routes/home'));
const Shopping = lazy(() => import('./routes/shopping'));
const Chores = lazy(() => import('./routes/chores'));
const Money = lazy(() => import('./routes/money'));
const Bills = lazy(() => import('./routes/bills'));
const Household = lazy(() => import('./routes/household'));
const Config = lazy(() => import('./routes/config'));

const App: Component = () => (
  <Router root={AppShell}>
    <Route path="/" component={Home} />
    <Route path="/list" component={Shopping} />
    <Route path="/chores" component={Chores} />
    <Route path="/money" component={Money} />
    <Route path="/bills" component={Bills} />
    <Route path="/household" component={Household} />
    <Route path="/config" component={Config} />
  </Router>
);

export default App;

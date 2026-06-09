import {render, screen} from '@testing-library/react';

it('renders smoke test', () => {
  render(<div>Hello</div>);
  expect(screen.getByText('Hello')).toBeInTheDocument();
});

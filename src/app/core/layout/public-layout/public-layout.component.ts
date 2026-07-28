import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { TopmenuComponent } from '../topmenu/topmenu.component';
import { FooterComponent } from '../footer/footer.component';

/**
 * Public shell (STANDARD-frontend-layout.md §Layout): skip-link, topmenu in
 * `public` mode, `<main>` content outlet and footer, in a flex column keeping
 * the footer at the bottom. Wraps the public/auth routes (/login, /privacy).
 */
@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [RouterOutlet, TranslocoPipe, TopmenuComponent, FooterComponent],
  templateUrl: './public-layout.component.html',
  styleUrl: './public-layout.component.scss',
})
export class PublicLayoutComponent {}

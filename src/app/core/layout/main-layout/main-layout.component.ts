import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { TopmenuComponent } from '../topmenu/topmenu.component';
import { FooterComponent } from '../footer/footer.component';

/**
 * Authenticated shell (STANDARD-frontend-layout.md §Layout): skip-link, topmenu
 * in `authenticated` mode, `<main>` content outlet and footer, in a flex column
 * that keeps the footer at the bottom. FoxRunner's offline/system banners are
 * stripped from this reference (no backend to monitor).
 */
@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, TranslocoPipe, TopmenuComponent, FooterComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
})
export class MainLayoutComponent {}

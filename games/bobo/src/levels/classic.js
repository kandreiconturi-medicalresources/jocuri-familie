// Nivelurile 1–3 din jocul original (portate), plus câte 3 steluțe.
import { LevelBuilder } from './builder.js';

function L1() {
  const b=new LevelBuilder(170);
  b.ground(0,40);b.ground(44,80);b.ground(84,115);b.ground(119,169);
  b.row(7,12,4,'o');
  b.put(14,11,'C');
  b.row(18,11,5,'B');b.put(19,11,'G');b.put(21,11,'Q');b.row(18,10,5,'o');
  b.snail(25);
  b.stairs(30,3,1);b.put(30,13,'o');b.put(31,12,'o');b.put(32,11,'o');
  b.snail(36);
  b.arc(41,3,12);
  b.snail(50);b.snail(58);
  b.row(52,11,4,'B');b.put(53,11,'G');
  b.row(58,7,4,'B');b.row(58,6,4,'o');
  b.check(66);
  b.snail(72);b.snail(77);
  b.arc(81,3,12);
  b.put(88,11,'G');b.put(89,11,'S');b.put(90,11,'G');
  b.snail(95);b.snail(100);b.snail(106);
  b.stairs(112,4,1);
  b.arc(116,3,10);
  b.row(124,11,5,'B');b.put(125,11,'G');b.put(124,11,'C');b.put(127,11,'Q');b.put(126,10,'h');
  b.snail(130);b.snail(136);b.snail(140);
  b.stairs(146,6,1);b.row(152,12,4,'o');
  b.portal.tx=160;
 b.put(60,4,'*');b.put(98,11,'*');b.put(150,8,'*');
 return b;
}
function L2() {
  const b=new LevelBuilder(185);
  b.ground(0,30);b.ground(35,60);b.ground(65,95);b.ground(111,140);b.ground(145,184);
  b.arc(8,4,12);
  b.row(14,11,3,'B');b.put(15,11,'G');b.put(16,11,'C');
  b.snail(20);b.snail(26);
  b.arc(31,4,11);
  b.bee(40,10,3);
  b.row(44,11,5,'B');b.put(45,11,'Q');b.put(47,11,'G');b.row(44,10,5,'o');
  b.snail(50);b.snail(55);
  b.stairs(57,4,1);
  b.arc(61,4,9);
  b.check(68);
  b.snail(73);b.put(76,14,'L');b.put(76,13,'L');b.bee(79,11,3);b.put(82,14,'L');b.put(82,13,'L');b.snail(86);
  b.put(87,11,'G');b.put(88,11,'S');b.put(89,11,'G');
  b.stairs(92,4,1);
  b.row(97,12,3,'=');b.row(97,11,3,'o');
  b.row(101,10,3,'=');b.row(101,9,3,'o');
  b.row(105,12,3,'=');b.row(105,11,3,'o');
  b.bee(103,6,2);
  b.check(114);
  b.snail(120);b.snail(124);b.bee(131,10,3);
  b.row(126,11,4,'B');b.put(127,11,'G');b.put(126,11,'C');b.put(129,11,'S');b.put(128,10,'h');
  b.stairs(137,4,1);
  b.arc(141,4,9);
  b.snail(150);b.snail(156);b.bee(160,10,3);b.snail(164);
  b.row(152,11,4,'B');b.put(153,11,'G');b.put(154,11,'Q');
  b.stairs(168,5,1);b.stairs(173,5,-1);b.put(172,8,'o');b.put(173,8,'o');
  b.portal.tx=180;
 b.put(60,9,'*');b.put(102,7,'*');b.put(170,7,'*');
 return b;
}
function L3() {
  const b=new LevelBuilder(195);
  b.ground(0,25);b.ground(30,60);b.ground(66,100);b.ground(105,135);b.ground(151,194);
  b.arc(6,5,12);
  b.row(12,11,4,'B');b.put(13,11,'G');b.put(14,11,'Q');b.put(12,11,'C');b.put(15,11,'S');
  b.snail(18);b.bee(22,11,3);
  b.arc(26,4,11);
  b.row(38,14,3,'^');b.arc(37,5,12);
  b.snail(46);b.snail(52);
  b.put(48,11,'G');b.put(49,11,'B');b.put(50,11,'G');
  b.put(55,14,'L');b.put(55,13,'L');
  b.check(58);
  b.row(62,13,3,'=');b.arc(61,5,10);
  b.snail(72);b.row(76,14,2,'^');b.bee(80,10,3);b.snail(83);
  b.stairs(86,4,1);b.stairs(90,4,-1);b.put(89,10,'o');b.put(90,10,'o');
  b.snail(96);
  b.arc(101,4,10);
  b.check(108);
  b.row(112,11,5,'B');b.put(113,11,'G');b.put(115,11,'Q');b.put(116,11,'C');b.put(112,11,'S');b.put(114,10,'h');
  b.snail(118);b.snail(122);b.row(125,14,3,'^');b.bee(127,11,3);b.snail(130);
  b.stairs(132,4,1);
  b.row(137,12,3,'=');b.row(137,11,3,'o');
  b.row(141,10,3,'=');b.row(141,9,3,'o');
  b.row(145,12,3,'=');b.row(145,11,3,'o');
  b.bee(142,6,2);
  b.check(154);
  b.snail(158);b.snail(162);b.row(165,14,2,'^');b.bee(168,10,3);
  b.stairs(172,8,1);b.row(180,12,3,'o');
  b.portal.tx=186;
 b.put(13,8,'*');b.put(88,8,'*');b.put(179,5,'*');
 return b;
}

export const CLASSIC = [L1, L2, L3];
